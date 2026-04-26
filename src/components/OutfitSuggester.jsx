import { useRef, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import ManualOutfits from './ManualOutfits.jsx'

const QUICK_CONTEXTS = [
  'Casual weekend, 25°C',
  'Work meeting, 20°C',
  'Dinner out, 18°C',
  'Beach day, 30°C',
  'Smart event, 15°C',
]

export default function OutfitSuggester({ messages, setMessages, wardrobe, setWardrobe }) {
  const [subTab,  setSubTab]  = useState('ai')   // 'ai' | 'manual'
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const fetchWardrobe = async () => {
    if (wardrobe) return wardrobe
    const { data, error: dbErr } = await supabase
      .from('wardrobe_items')
      .select('id, name, category, colour, brand')
    if (dbErr) throw dbErr
    if (!data || data.length === 0) throw new Error('Your wardrobe is empty — add some items first!')
    setWardrobe(data)
    return data
  }

  const sendMessage = async (text) => {
    const userText = (text ?? input).trim()
    if (!userText) return
    setError(null)
    setInput('')
    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const wdrobe = await fetchWardrobe()
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, wardrobe: wdrobe }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      const { reply } = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
      setMessages(messages)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const reset = () => { setMessages([]); setInput(''); setError(null) }
  const isEmpty = messages.length === 0

  return (
    <div>
      {/* Page title */}
      <h1 className="page-title">Outfit Ideas</h1>

      {/* Inner tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ id: 'ai', label: '✨ AI Stylist' }, { id: 'manual', label: '👚 My Outfits' }].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: 10,
              border: subTab === t.id ? 'none' : '1.5px solid var(--border)',
              background: subTab === t.id ? 'var(--accent)' : 'transparent',
              color: subTab === t.id ? '#fff' : 'var(--text)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* AI Stylist tab */}
      {subTab === 'ai' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            {!isEmpty && (
              <button className="btn btn-ghost" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }} onClick={reset}>
                New chat
              </button>
            )}
          </div>

          {isEmpty && (
            <div>
              <p className="text-muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
                Describe where you're going and the weather — then keep chatting to fine-tune.
              </p>
              <div className="filter-bar" style={{ marginBottom: 16 }}>
                {QUICK_CONTEXTS.map(q => (
                  <button key={q} className="filter-chip" onClick={() => sendMessage(q)} disabled={loading}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {!isEmpty && (
            <div style={{ marginBottom: 12 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                    color: msg.role === 'user' ? '#fff' : 'var(--text)',
                    fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.07)',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                  <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: 'var(--surface)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="spinner" style={{ width: 14, height: 14 }} /> Thinking…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {error && <div className="banner banner-error" style={{ marginBottom: 8 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              placeholder={isEmpty ? 'e.g. Work presentation, 22°C, need to look polished' : 'Ask a follow-up…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={loading}
              style={{
                flex: 1, resize: 'none', padding: '10px 12px', fontSize: 15,
                borderRadius: 12, border: '1.5px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)',
                outline: 'none', fontFamily: 'inherit', minWidth: 0,
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: 44, height: 44, flexShrink: 0, borderRadius: '50%',
                border: 'none', background: 'var(--accent)', color: '#fff',
                fontSize: 18, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                opacity: (loading || !input.trim()) ? 0.4 : 1, transition: 'opacity .15s',
              }}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> : '↑'}
            </button>
          </div>
          {isEmpty && <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>Press Enter to send · Shift+Enter for new line</p>}
        </div>
      )}

      {/* My Outfits tab */}
      {subTab === 'manual' && <ManualOutfits />}
    </div>
  )
}
