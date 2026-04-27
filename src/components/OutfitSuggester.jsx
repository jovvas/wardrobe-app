import { useRef, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import ManualOutfits from './ManualOutfits.jsx'
import {
  getLocationAndWeather,
  geocodeCity,
  fetchForecast,
  formatForecastForAI,
  extractCityFromText,
} from '../utils/weather.js'

const QUICK_CONTEXTS = [
  'Casual day out, what should I wear?',
  'Work meeting tomorrow',
  'Dinner out tonight',
  'Beach day',
  'Smart casual event',
]

export default function OutfitSuggester({ messages, setMessages, wardrobe, setWardrobe }) {
  const [subTab,      setSubTab]      = useState('ai')   // 'ai' | 'manual'
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  // Location & weather
  const [locationData, setLocationData] = useState(null)   // { city, country, lat, lon, context }
  const [locLoading,   setLocLoading]   = useState(false)
  const [locError,     setLocError]     = useState(null)
  // Save-to-outfits state
  const [saveTarget,  setSaveTarget]  = useState(null)   // { msgIndex, name } or null
  const [savingMsg,   setSavingMsg]   = useState(false)
  const [savedMsgs,   setSavedMsgs]   = useState(new Set())
  const bottomRef = useRef(null)

  // Load location + weather when component mounts
  useEffect(() => {
    loadLocation()
  }, [])

  const loadLocation = async () => {
    setLocLoading(true)
    setLocError(null)
    try {
      const data = await getLocationAndWeather()
      setLocationData(data)
    } catch (err) {
      // Permission denied or not supported — not a fatal error, just no weather
      setLocError(err.code === 1 ? 'Location permission denied' : 'Could not get location')
    } finally {
      setLocLoading(false)
    }
  }

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

  // Build weather context for this message:
  // If user mentions a city different from their location, fetch that city's weather too
  const buildWeatherContext = async (userText) => {
    const mentionedCity = extractCityFromText(userText)
    const contexts = []

    // Always include user's local weather if available
    if (locationData?.context) {
      contexts.push(locationData.context)
    }

    // If a different city was mentioned, fetch its weather
    if (mentionedCity) {
      const homeCity = locationData?.city?.toLowerCase() ?? ''
      if (!homeCity || !mentionedCity.toLowerCase().includes(homeCity)) {
        try {
          const geo = await geocodeCity(mentionedCity)
          if (geo) {
            const forecast = await fetchForecast(geo.lat, geo.lon)
            const ctx = formatForecastForAI(geo.city, geo.country, forecast)
            if (ctx) contexts.push(ctx)
          }
        } catch { /* silently skip if geocoding fails */ }
      }
    }

    return contexts.length > 0 ? contexts.join('\n\n') : null
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
      const [wdrobe, weatherContext] = await Promise.all([
        fetchWardrobe(),
        buildWeatherContext(userText),
      ])
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, wardrobe: wdrobe, weatherContext }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      const { reply, item_ids } = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: reply, item_ids: item_ids ?? null }])
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

  const reset = () => {
    setMessages([])
    setInput('')
    setError(null)
    setSaveTarget(null)
    setSavedMsgs(new Set())
  }

  const saveOutfit = async () => {
    if (!saveTarget || !saveTarget.name.trim()) return
    setSavingMsg(true)
    const msg = messages[saveTarget.msgIndex]
    const { error: err } = await supabase
      .from('outfits')
      .insert({ name: saveTarget.name.trim(), item_ids: msg.item_ids })
    if (err) {
      setError('Could not save outfit: ' + err.message)
    } else {
      setSavedMsgs(prev => new Set(prev).add(saveTarget.msgIndex))
      setSaveTarget(null)
    }
    setSavingMsg(false)
  }

  const isEmpty = messages.length === 0

  // ── Location pill ────────────────────────────────────────────
  const LocationPill = () => {
    if (locLoading) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        <span className="spinner" style={{ width: 11, height: 11, border: '1.5px solid var(--border)', borderTopColor: 'var(--muted)' }} />
        Detecting location…
      </div>
    )
    if (locationData?.city) return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 12, color: 'var(--accent-dk)', fontWeight: 600,
        background: '#fdf8f0', border: '1px solid #e8d8b8',
        borderRadius: 99, padding: '4px 10px', marginBottom: 12,
      }}>
        📍 {locationData.city}{locationData.country ? `, ${locationData.country}` : ''} · weather loaded
      </div>
    )
    if (locError) return (
      <button
        onClick={loadLocation}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: 'var(--muted)', fontWeight: 500,
          background: 'none', border: '1px dashed var(--border)',
          borderRadius: 99, padding: '4px 10px', marginBottom: 12,
          cursor: 'pointer',
        }}
      >
        📍 Enable location for weather-aware suggestions
      </button>
    )
    return null
  }

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
              flex: 1, padding: '9px 0', borderRadius: 10,
              border: subTab === t.id ? 'none' : '1.5px solid var(--border)',
              background: subTab === t.id ? 'var(--accent)' : 'transparent',
              color: subTab === t.id ? '#fff' : 'var(--text)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* AI Stylist tab */}
      {subTab === 'ai' && (
        <div>
          {/* Location pill */}
          <LocationPill />

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
                {locationData?.city
                  ? `I know you're in ${locationData.city} — ask me anything and I'll factor in the forecast.`
                  : 'Describe where you're going and I'll suggest an outfit from your wardrobe.'}
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
                <div key={i} style={{ marginBottom: 10 }}>
                  {/* Message bubble */}
                  <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
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

                  {/* Save to My Outfits — shown under assistant messages that have item_ids */}
                  {msg.role === 'assistant' && msg.item_ids && msg.item_ids.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 6, paddingLeft: 4 }}>
                      {savedMsgs.has(i) ? (
                        <span style={{ fontSize: 12, color: '#2e7d52', fontWeight: 600 }}>✓ Saved to My Outfits</span>
                      ) : saveTarget?.msgIndex === i ? (
                        <div style={{
                          display: 'flex', gap: 6, alignItems: 'center',
                          background: 'var(--surface)', borderRadius: 12,
                          padding: '8px 10px', border: '1.5px solid var(--border)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                        }}>
                          <input
                            type="text"
                            placeholder="Outfit name…"
                            value={saveTarget.name}
                            onChange={e => setSaveTarget(t => ({ ...t, name: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && saveOutfit()}
                            autoFocus
                            maxLength={60}
                            style={{
                              width: 160, padding: '6px 10px', fontSize: 13,
                              borderRadius: 8, border: '1px solid var(--border)',
                              background: 'var(--bg)', color: 'var(--text)',
                            }}
                          />
                          <button
                            onClick={saveOutfit}
                            disabled={savingMsg || !saveTarget.name.trim()}
                            style={{
                              padding: '6px 12px', borderRadius: 8, border: 'none',
                              background: 'var(--accent)', color: '#fff',
                              fontSize: 13, fontWeight: 600, cursor: 'pointer',
                              opacity: (savingMsg || !saveTarget.name.trim()) ? 0.5 : 1,
                            }}
                          >
                            {savingMsg ? '…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setSaveTarget(null)}
                            style={{
                              padding: '6px 8px', borderRadius: 8,
                              border: '1px solid var(--border)', background: 'none',
                              fontSize: 13, color: 'var(--muted)', cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSaveTarget({ msgIndex: i, name: '' })}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 99,
                            border: '1.5px solid var(--border)', background: 'var(--surface)',
                            fontSize: 12, fontWeight: 600, color: 'var(--accent-dk)',
                            cursor: 'pointer',
                          }}
                        >
                          💾 Save as outfit
                        </button>
                      )}
                    </div>
                  )}
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
              placeholder={
                isEmpty
                  ? locationData?.city
                    ? `What's the occasion? I'll check the ${locationData.city} forecast…`
                    : 'e.g. Work presentation tomorrow, need to look polished'
                  : 'Ask a follow-up…'
              }
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
