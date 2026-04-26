import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabaseClient.js'

const QUICK_CONTEXTS = [
  'Casual weekend, 25°C',
  'Work meeting, 20°C',
  'Dinner out, 18°C',
  'Beach day, 30°C',
  'Smart event, 15°C',
]

export default function OutfitSuggester() {
  const [messages,  setMessages]  = useState([])   // { role: 'user'|'assistant', content: string }
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [wardrobe,  setWardrobe]  = useState(null)  // cached after first send
  const bottomRef = useRef(null)

  // Scroll to latest message
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
      // Remove the user message we optimistically added
      setMessages(messages)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const reset = () => {
    setMessages([])
    setInput('')
    setError(null)
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Outfit Ideas</h1>
        {!isEmpty && (
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={reset}>
            New chat
          </button>
        )}
      </div>

      {/* Empty state — show prompt + quick chips */}
      {isEmpty && (
        <div style={{ marginTop: 16 }}>
          <p className="text-muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
            Describe where you're going and the weather — then keep chatting to fine-tune.
          </p>
          <div className="filter-bar" style={{ marginBottom: 16 }}>
            {QUICK_CONTEXTS.map(q => (
              <button
                key={q}
                className="filter-chip"
                onClick={() => sendMessage(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat history */}
      {!isEmpty && (
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 16, marginBottom: 12 }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: msg.role === 'user' ? '#fff' : 'var(--color-text)',
                  fontSize: 14,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.07)',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '18px 18px 18px 4px',
                background: 'var(--color-surface)',
                fontSize: 14,
              }}>
                <span className="spinner" style={{ width: 14, height: 14, marginRight: 6 }} />
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {error && <div className="banner banner-error" style={{ marginBottom: 8 }}>{error}</div>}

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingTop: 4 }}>
        <textarea
          placeholder={isEmpty ? 'e.g. Work presentation, 22°C, need to look polished' : 'Ask a follow-up…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          style={{ flex: 1, resize: 'none' }}
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{ flexShrink: 0, alignSelf: 'flex-end' }}
        >
          {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : '↑'}
        </button>
      </div>
      {isEmpty && (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      )}
    </div>
  )
}
