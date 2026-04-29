// Vercel serverless function — proxies outfit chat requests to Anthropic.
// The ANTHROPIC_API_KEY env var is set in Vercel's dashboard and never
// exposed to the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, wardrobe, weatherContext } = req.body ?? {}

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages is required' })
  }
  if (!Array.isArray(wardrobe) || wardrobe.length === 0) {
    return res.status(400).json({ error: 'wardrobe must be a non-empty array' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured on server' })
  }

  // Build wardrobe list — include IDs so Claude can tag outfit items
  const wardrobeList = wardrobe
    .map(item =>
      `• [${item.id}] ${item.name}${item.brand ? ` (${item.brand})` : ''} — ${item.category}, ${item.colour}`
    )
    .join('\n')

  const weatherSection = weatherContext
    ? `\n\n${weatherContext}\n\nUse the forecast above when the user mentions specific days (e.g. "tomorrow", "next Friday") or weather conditions. Factor in temperature and precipitation when recommending layers, fabrics, and outfit choices.`
    : ''

  const systemPrompt =
    `You are a personal stylist assistant. ` +
    `Only suggest outfits using items from the user's wardrobe listed below. ` +
    `Be concise and practical. If the wardrobe is missing something obvious, briefly note it.` +
    weatherSection +
    `\n\nThe user's wardrobe (format: [id] name — category, colour):\n${wardrobeList}\n\n` +
    `IMPORTANT: When you recommend a specific outfit combination with concrete items, ` +
    `append ONE line at the very end of your response in exactly this format (no spaces, no markdown fences):\n` +
    `OUTFIT_IDS:["id1","id2","id3"]\n` +
    `List only the IDs of the items you are including in the outfit. ` +
    `Omit this line entirely when giving general advice, asking questions, or not recommending a specific combination.`

  // Strip any extra properties (e.g. item_ids) — Anthropic only accepts role + content
  const cleanMessages = messages.map(({ role, content }) => ({ role, content }))

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: cleanMessages,
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic API error:', errText)
      return res.status(anthropicRes.status).json({ error: 'Anthropic API error', detail: errText })
    }

    const data = await anthropicRes.json()
    const rawReply = data?.content?.[0]?.text ?? ''

    // Extract OUTFIT_IDS from the end of the reply (if present)
    const idMatch = rawReply.match(/\nOUTFIT_IDS:(\[.*?\])\s*$/)
    let item_ids = null
    if (idMatch) {
      try { item_ids = JSON.parse(idMatch[1]) } catch { /* ignore malformed */ }
    }
    const reply = rawReply.replace(/\nOUTFIT_IDS:\[.*?\]\s*$/, '').trim()

    return res.status(200).json({ reply, item_ids })
  } catch (err) {
    console.error('suggest.js error:', err)
    return res.status(500).json({ error: err.message })
  }
}
