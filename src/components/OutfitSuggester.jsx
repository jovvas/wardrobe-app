import { useState } from 'react'
import { supabase } from '../supabaseClient.js'

const QUICK_CONTEXTS = [
  'Casual weekend, 25°C',
  'Work meeting, 20°C',
  'Dinner out, 18°C',
  'Beach day, 30°C',
  'Smart event, 15°C',
]

export default function OutfitSuggester() {
  const [context,    setContext]    = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  const suggest = async () => {
    const ctx = context.trim()
    if (!ctx) return setError('Please describe the occasion or context first.')
    setError(null)
    setSuggestion(null)
    setLoading(true)

    try {
      // Fetch wardrobe
      const { data: wardrobe, error: dbErr } = await supabase
        .from('wardrobe_items')
        .select('id, name, category, colour')
      if (dbErr) throw dbErr

      if (!wardrobe || wardrobe.length === 0) {
        setError('Your wardrobe is empty — add some items first!')
        setLoading(false)
        return
      }

      // Call the Vercel serverless function
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: ctx, wardrobe }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }

      const { suggestion: text } = await res.json()
      setSuggestion(text)
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Outfit Ideas</h1>

      <p className="text-muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        Describe where you're going and the weather — Claude will suggest outfits from your wardrobe.
      </p>

      <div className="form-group">
        <label>Context</label>
        <textarea
          placeholder="e.g. Work presentation, 22°C, need to look polished"
          value={context}
          onChange={e => setContext(e.target.value)}
          rows={3}
        />
      </div>

      {/* Quick-pick suggestions */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {QUICK_CONTEXTS.map(q => (
          <button
            key={q}
            className="filter-chip"
            onClick={() => setContext(q)}
          >
            {q}
          </button>
        ))}
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <button
        className="btn btn-primary"
        onClick={suggest}
        disabled={loading || !context.trim()}
      >
        {loading ? <><span className="spinner" /> Getting suggestions…</> : '✨ Suggest outfits'}
      </button>

      {suggestion && (
        <div className="mt-16">
          <div className="suggestion-box">{suggestion}</div>
          <button
            className="btn btn-ghost mt-8"
            onClick={() => { setSuggestion(null); setContext('') }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
