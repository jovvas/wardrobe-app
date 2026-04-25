// Vercel serverless function — proxies outfit suggestion requests to Anthropic.
// The ANTHROPIC_API_KEY env var is set in Vercel's dashboard and never
// exposed to the browser.

export default async function handler(req, res) {
  // Only POST is accepted
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { context, wardrobe } = req.body ?? {}

  if (!context) {
    return res.status(400).json({ error: 'context is required' })
  }
  if (!Array.isArray(wardrobe) || wardrobe.length === 0) {
    return res.status(400).json({ error: 'wardrobe must be a non-empty array' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured on server' })
  }

  // Build a readable wardrobe list for the prompt
  const wardrobeList = wardrobe
    .map(item =>
      `• ${item.name} — ${item.category}, ${item.colour}, ${item.formality}, ${item.season}`
    )
    .join('\n')

  const userPrompt =
    `My wardrobe:\n${wardrobeList}\n\n` +
    `Occasion / context: ${context}\n\n` +
    `Suggest 2–3 complete outfits using only items from my wardrobe above. ` +
    `For each outfit list the exact item names and give one sentence on why it works. ` +
    `Be concise and practical. If the wardrobe is missing something obvious, briefly note it.`

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic API error:', errText)
      return res.status(anthropicRes.status).json({ error: 'Anthropic API error', detail: errText })
    }

    const data = await anthropicRes.json()
    const suggestion = data?.content?.[0]?.text ?? ''
    return res.status(200).json({ suggestion })
  } catch (err) {
    console.error('suggest.js error:', err)
    return res.status(500).json({ error: err.message })
  }
}
