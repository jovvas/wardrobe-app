import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient.js'

const PLACEHOLDER_EMOJI = {
  'Short Sleeve': '👕', 'Long Sleeve': '👕', Pants: '👖', Shorts: '🩳',
  Dresses: '👗', Outerwear: '🧥', Shoes: '👟', Accessories: '💍', Bags: '👜',
}

export default function AddToOutfitModal({ item, onClose }) {
  const [outfits,    setOutfits]    = useState([])
  const [allItems,   setAllItems]   = useState({})   // id → item, for thumbnails
  const [loading,    setLoading]    = useState(true)
  const [newName,    setNewName]    = useState('')
  const [creating,   setCreating]   = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [done,       setDone]       = useState(null)  // success message
  const [saveError,  setSaveError]  = useState(null)  // error message

  useEffect(() => {
    Promise.all([
      supabase.from('outfits').select('*').order('created_at', { ascending: false }),
      supabase.from('wardrobe_items').select('id, name, category, photo_url'),
    ]).then(([oRes, wRes]) => {
      setOutfits(oRes.data ?? [])
      const map = {}
      ;(wRes.data ?? []).forEach(i => { map[i.id] = i })
      setAllItems(map)
      setLoading(false)
    })
  }, [])

  const addToExisting = async (outfit) => {
    if ((outfit.item_ids ?? []).includes(item.id)) return
    setSaveError(null)
    const { error } = await supabase
      .from('outfits')
      .update({ item_ids: [...(outfit.item_ids ?? []), item.id] })
      .eq('id', outfit.id)
    if (error) {
      setSaveError(error.message)
    } else {
      setDone(`Added to "${outfit.name}"`)
      setTimeout(onClose, 1400)
    }
  }

  const createNew = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setSaveError(null)
    const { error } = await supabase
      .from('outfits')
      .insert({ name: newName.trim(), item_ids: [item.id] })
    if (error) {
      setSaveError(error.message)
    } else {
      setDone(`"${newName.trim()}" created`)
      setTimeout(onClose, 1400)
    }
    setCreating(false)
  }

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--bg, #fdf8f4)',
          borderRadius: '20px',
          maxHeight: '82dvh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* Item preview header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          {item.photo_url ? (
            <img src={item.photo_url} alt={item.name} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
              {PLACEHOLDER_EMOJI[item.category] ?? '👔'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Add to outfit</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--muted)', cursor: 'pointer', padding: '4px 6px', flexShrink: 0 }}>✕</button>
        </div>

        {/* Success state */}
        {done && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: 16, textAlign: 'center' }}>{done}</div>
          </div>
        )}

        {/* Content */}
        {!done && (
          <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px 20px', WebkitOverflowScrolling: 'touch' }}>

            {saveError && (
              <div className="banner banner-error" style={{ marginBottom: 12 }}>{saveError}</div>
            )}

            {loading && <p className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</p>}

            {/* Existing outfits */}
            {!loading && outfits.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>
                  Your outfits
                </p>
                {outfits.map(outfit => {
                  const alreadyIn = (outfit.item_ids ?? []).includes(item.id)
                  const previewItems = (outfit.item_ids ?? []).slice(0, 4).map(id => allItems[id]).filter(Boolean)
                  return (
                    <button
                      key={outfit.id}
                      onClick={() => !alreadyIn && addToExisting(outfit)}
                      disabled={alreadyIn}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', marginBottom: 8,
                        borderRadius: 14, border: '1.5px solid var(--border)',
                        background: alreadyIn ? 'var(--surface)' : 'var(--bg, #fdf8f4)',
                        cursor: alreadyIn ? 'default' : 'pointer',
                        opacity: alreadyIn ? 0.55 : 1,
                        textAlign: 'left',
                      }}
                    >
                      {/* Thumbnail stack */}
                      <div style={{ display: 'flex', flexShrink: 0 }}>
                        {previewItems.length > 0 ? previewItems.map((pi, idx) => (
                          <div key={pi.id} style={{ marginLeft: idx > 0 ? -10 : 0, zIndex: previewItems.length - idx }}>
                            {pi.photo_url ? (
                              <img src={pi.photo_url} alt={pi.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--bg, #fdf8f4)' }} />
                            ) : (
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, border: '2px solid var(--bg, #fdf8f4)' }}>
                                {PLACEHOLDER_EMOJI[pi.category] ?? '👔'}
                              </div>
                            )}
                          </div>
                        )) : (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👗</div>
                        )}
                      </div>

                      {/* Name + count */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{outfit.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          {(outfit.item_ids ?? []).length} item{(outfit.item_ids ?? []).length !== 1 ? 's' : ''}
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{ flexShrink: 0, fontSize: 13, color: alreadyIn ? 'var(--muted)' : 'var(--accent)', fontWeight: 600 }}>
                        {alreadyIn ? '✓ added' : '+ Add'}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {!loading && outfits.length === 0 && !showCreate && (
              <p className="text-muted" style={{ textAlign: 'center', padding: '16px 0', fontSize: 14 }}>No outfits yet — create your first one below.</p>
            )}

            {/* Create new outfit */}
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  width: '100%', padding: '13px 0',
                  borderRadius: 14, border: '1.5px dashed var(--border)',
                  background: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600, color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                + Create new outfit
              </button>
            ) : (
              <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '14px 14px', border: '1.5px solid var(--border)' }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>New outfit name</p>
                <input
                  type="text"
                  placeholder="e.g. Summer brunch look"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createNew()}
                  maxLength={60}
                  autoFocus
                  style={{ marginBottom: 10 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => { setShowCreate(false); setNewName('') }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={createNew}
                    disabled={creating || !newName.trim()}
                  >
                    {creating ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Create & add'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
