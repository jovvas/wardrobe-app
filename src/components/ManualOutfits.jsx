import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient.js'

const PLACEHOLDER_EMOJI = {
  'Short Sleeve': '👕', 'Long Sleeve': '👕', Pants: '👖', Shorts: '🩳',
  Dresses: '👗', Outerwear: '🧥', Shoes: '👟', Accessories: '💍', Bags: '👜',
}

export default function ManualOutfits() {
  const [view,       setView]       = useState('list')   // 'list' | 'builder'
  const [outfits,    setOutfits]    = useState([])
  const [wardrobe,   setWardrobe]   = useState([])
  const [selected,   setSelected]   = useState(new Set())
  const [outfitName, setOutfitName] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [wRes, oRes] = await Promise.all([
      supabase.from('wardrobe_items').select('*').order('category'),
      supabase.from('outfits').select('*').order('created_at', { ascending: false }),
    ])
    if (wRes.data)  setWardrobe(wRes.data)
    if (oRes.data)  setOutfits(oRes.data)
    setLoading(false)
  }

  const toggleItem = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const saveOutfit = async () => {
    if (!outfitName.trim()) return setError('Give your outfit a name.')
    if (selected.size === 0) return setError('Select at least one item.')
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('outfits')
      .insert({ name: outfitName.trim(), item_ids: [...selected] })
      .select()
      .single()
    if (err) {
      setError(err.message)
    } else {
      setOutfits(prev => [data, ...prev])
      setSelected(new Set())
      setOutfitName('')
      setView('list')
    }
    setSaving(false)
  }

  const deleteOutfit = async (id) => {
    if (!window.confirm('Remove this outfit?')) return
    const { error: err } = await supabase.from('outfits').delete().eq('id', id)
    if (!err) setOutfits(prev => prev.filter(o => o.id !== id))
  }

  const wardrobeById = Object.fromEntries(wardrobe.map(i => [i.id, i]))

  // ── Builder view ────────────────────────────────────────────
  if (view === 'builder') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            className="btn btn-ghost"
            style={{ width: 'auto', padding: '8px 12px' }}
            onClick={() => { setView('list'); setSelected(new Set()); setOutfitName(''); setError(null) }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>New Outfit</h2>
        </div>

        {error && <div className="banner banner-error" style={{ marginBottom: 10 }}>{error}</div>}

        <div className="form-group">
          <label>Outfit name</label>
          <input
            type="text"
            placeholder="e.g. Summer brunch look"
            value={outfitName}
            onChange={e => setOutfitName(e.target.value)}
            maxLength={60}
          />
        </div>

        <p className="text-muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Tap items to add them to this outfit ({selected.size} selected)
        </p>

        {/* Group wardrobe items by category */}
        {(() => {
          const groups = wardrobe.reduce((acc, item) => {
            ;(acc[item.category] = acc[item.category] || []).push(item)
            return acc
          }, {})
          return Object.entries(groups).map(([category, items]) => (
            <div key={category} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.07em', color: 'var(--text-muted)',
                marginBottom: 8, paddingBottom: 4,
                borderBottom: '1px solid var(--border)',
              }}>
                {PLACEHOLDER_EMOJI[category] ?? '👔'} {category}
              </div>
              <div className="wardrobe-grid">
                {items.map(item => {
                  const isSelected = selected.has(item.id)
                  return (
                    <div
                      key={item.id}
                      className="item-card"
                      onClick={() => toggleItem(item.id)}
                      style={{
                        cursor: 'pointer',
                        outline: isSelected ? '2.5px solid var(--accent)' : 'none',
                        position: 'relative',
                      }}
                    >
                      {isSelected && (
                        <div style={{
                          position: 'absolute', top: 6, right: 6, zIndex: 2,
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'var(--accent)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                        }}>✓</div>
                      )}
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.name} loading="lazy" />
                      ) : (
                        <div className="item-card-placeholder">
                          {PLACEHOLDER_EMOJI[item.category] ?? '👔'}
                        </div>
                      )}
                      <div className="item-card-body">
                        <div className="item-card-name">{item.name}</div>
                        <div className="item-card-meta">{item.colour}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        })()}

        <button
          className="btn btn-primary"
          onClick={saveOutfit}
          disabled={saving || selected.size === 0 || !outfitName.trim()}
        >
          {saving ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Saving…</> : `💾 Save outfit (${selected.size} items)`}
        </button>
      </div>
    )
  }

  // ── List view ───────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
          {outfits.length === 0 ? 'No outfits saved yet.' : `${outfits.length} saved outfit${outfits.length !== 1 ? 's' : ''}`}
        </p>
        <button
          className="btn btn-primary"
          style={{ width: 'auto', padding: '10px 16px', fontSize: 14 }}
          onClick={() => setView('builder')}
          disabled={wardrobe.length === 0}
        >
          + New outfit
        </button>
      </div>

      {loading && <p className="text-muted">Loading…</p>}

      {!loading && outfits.length === 0 && (
        <div className="empty">
          <div className="empty-icon">👚</div>
          <p>Build your first outfit by tapping "New outfit".</p>
        </div>
      )}

      {outfits.map(outfit => {
        const items = (outfit.item_ids ?? [])
          .map(id => wardrobeById[id])
          .filter(Boolean)

        return (
          <div key={outfit.id} style={{
            background: 'var(--surface)',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{outfit.name}</span>
              <button
                onClick={() => deleteOutfit(outfit.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 16, padding: '0 2px',
                }}
                title="Delete outfit"
              >✕</button>
            </div>

            {/* Item thumbnails */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {items.map(item => (
                <div key={item.id} style={{ textAlign: 'center', width: 60 }}>
                  {item.photo_url ? (
                    <img
                      src={item.photo_url}
                      alt={item.name}
                      style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                    />
                  ) : (
                    <div style={{
                      width: 60, height: 60, borderRadius: 8,
                      background: 'var(--bg)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 24,
                    }}>
                      {PLACEHOLDER_EMOJI[item.category] ?? '👔'}
                    </div>
                  )}
                  <div style={{ fontSize: 10, marginTop: 3, color: 'var(--text-muted)', lineHeight: 1.2, wordBreak: 'break-word' }}>
                    {item.name.length > 14 ? item.name.slice(0, 13) + '…' : item.name}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <span className="text-muted" style={{ fontSize: 13 }}>No items found</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
