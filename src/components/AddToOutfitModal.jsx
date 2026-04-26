import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient.js'

export default function AddToOutfitModal({ item, onClose }) {
  const [outfits,     setOutfits]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [newName,     setNewName]     = useState('')
  const [creating,    setCreating]    = useState(false)
  const [feedback,    setFeedback]    = useState(null)  // { type: 'success'|'error', msg }

  useEffect(() => {
    supabase
      .from('outfits')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOutfits(data ?? []); setLoading(false) })
  }, [])

  const addToExisting = async (outfit) => {
    if ((outfit.item_ids ?? []).includes(item.id)) {
      setFeedback({ type: 'error', msg: `"${item.name}" is already in "${outfit.name}".` })
      return
    }
    const { error } = await supabase
      .from('outfits')
      .update({ item_ids: [...(outfit.item_ids ?? []), item.id] })
      .eq('id', outfit.id)
    if (error) {
      setFeedback({ type: 'error', msg: error.message })
    } else {
      setFeedback({ type: 'success', msg: `Added to "${outfit.name}"!` })
      setTimeout(onClose, 1200)
    }
  }

  const createNew = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const { error } = await supabase
      .from('outfits')
      .insert({ name: newName.trim(), item_ids: [item.id] })
    if (error) {
      setFeedback({ type: 'error', msg: error.message })
    } else {
      setFeedback({ type: 'success', msg: `Outfit "${newName.trim()}" created!` })
      setTimeout(onClose, 1200)
    }
    setCreating(false)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <h2 className="modal-title">Add to Outfit</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
            Adding: <strong>{item.name}</strong>
          </p>

          {feedback && (
            <div className={`banner banner-${feedback.type === 'success' ? 'info' : 'error'}`} style={{ marginBottom: 12 }}>
              {feedback.type === 'success' ? '✅ ' : ''}{feedback.msg}
            </div>
          )}

          {/* Existing outfits */}
          {loading && <p className="text-muted">Loading outfits…</p>}

          {!loading && outfits.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Add to existing outfit</p>
              {outfits.map(outfit => {
                const alreadyIn = (outfit.item_ids ?? []).includes(item.id)
                return (
                  <button
                    key={outfit.id}
                    onClick={() => addToExisting(outfit)}
                    disabled={alreadyIn}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      padding: '10px 14px',
                      marginBottom: 8,
                      borderRadius: 10,
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface)',
                      cursor: alreadyIn ? 'default' : 'pointer',
                      opacity: alreadyIn ? 0.5 : 1,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    <span>{outfit.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {alreadyIn ? '✓ added' : `${(outfit.item_ids ?? []).length} items`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {!loading && outfits.length === 0 && (
            <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>No outfits yet — create one below.</p>
          )}

          {/* Create new */}
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Create new outfit</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="e.g. Summer brunch look"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createNew()}
              maxLength={60}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              style={{ width: 'auto', padding: '0 16px', flexShrink: 0 }}
              onClick={createNew}
              disabled={creating || !newName.trim()}
            >
              {creating ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
