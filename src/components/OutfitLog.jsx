import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient.js'

export default function OutfitLog() {
  const [tab,      setTab]      = useState('log')    // 'log' | 'history'
  const [wardrobe, setWardrobe] = useState([])
  const [logs,     setLogs]     = useState([])
  const [selected, setSelected] = useState([])       // item ids
  const [context,  setContext]  = useState('')
  const [date,     setDate]     = useState(today())
  const [loading,  setLoading]  = useState(false)
  const [fetchingLogs, setFetchingLogs] = useState(false)
  const [error,    setError]    = useState(null)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => { fetchWardrobe() }, [])
  useEffect(() => { if (tab === 'history') fetchLogs() }, [tab])

  function today() {
    return new Date().toISOString().slice(0, 10)
  }

  const fetchWardrobe = async () => {
    const { data } = await supabase
      .from('wardrobe_items')
      .select('id, name, category, colour')
      .order('category')
    setWardrobe(data ?? [])
  }

  const fetchLogs = async () => {
    setFetchingLogs(true)
    const { data, error: err } = await supabase
      .from('outfit_logs')
      .select('*')
      .order('worn_on', { ascending: false })
      .limit(50)
    if (!err) setLogs(data ?? [])
    setFetchingLogs(false)
  }

  const toggleItem = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (selected.length === 0) return setError('Select at least one item.')
    setError(null)
    setLoading(true)
    const { error: err } = await supabase
      .from('outfit_logs')
      .insert({ item_ids: selected, context: context.trim() || null, worn_on: date })
    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setSelected([])
      setContext('')
      setDate(today())
      setTimeout(() => setSaved(false), 3000)
    }
    setLoading(false)
  }

  // Look up item names for a log entry
  const itemNames = (ids) => {
    const map = Object.fromEntries(wardrobe.map(i => [i.id, i.name]))
    return ids.map(id => map[id] ?? 'Unknown item').join(', ')
  }

  const formatDate = (d) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })

  return (
    <div>
      <h1 className="page-title">Outfit Log</h1>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['log', 'history'].map(t => (
          <button
            key={t}
            className={`filter-chip${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
            style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}
          >
            {t === 'log' ? '📝 Log today' : '📋 History'}
          </button>
        ))}
      </div>

      {/* ── LOG TAB ──────────────────────────────────────────── */}
      {tab === 'log' && (
        <>
          {error  && <div className="banner banner-error">{error}</div>}
          {saved  && <div className="banner banner-success">Outfit logged!</div>}

          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>What did you wear? {selected.length > 0 && `(${selected.length} selected)`}</label>
            {wardrobe.length === 0 ? (
              <p className="text-muted">Add items to your wardrobe first.</p>
            ) : (
              <div className="item-picker">
                {wardrobe.map(item => (
                  <label
                    key={item.id}
                    className={`item-pick-option${selected.includes(item.id) ? ' selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Work presentation, felt good"
              value={context}
              onChange={e => setContext(e.target.value)}
              maxLength={120}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading || selected.length === 0}
          >
            {loading ? <><span className="spinner" /> Saving…</> : '💾 Save outfit'}
          </button>
        </>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────── */}
      {tab === 'history' && (
        <>
          {fetchingLogs && <p className="text-muted">Loading…</p>}

          {!fetchingLogs && logs.length === 0 && (
            <div className="empty">
              <div className="empty-icon">📋</div>
              <p>No outfits logged yet.\nStart logging what you wear!</p>
            </div>
          )}

          {logs.map(log => (
            <div key={log.id} className="log-entry">
              <div className="log-entry-date">{formatDate(log.worn_on)}</div>
              <div className="log-entry-items">{itemNames(log.item_ids)}</div>
              {log.context && (
                <div className="log-entry-context">{log.context}</div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
