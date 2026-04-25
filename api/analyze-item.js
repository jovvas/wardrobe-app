// Vercel serverless function — sends a clothing photo to Claude vision
// and returns suggested field values for the Add Item form.

const VALID_CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags']
const VALID_SEASONS    = ['Spring', 'Summer', 'Autumn', 'Winter']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, mediaType } = req.body ?? {}
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured on server' })
  }

  const prompt =
    `You are analysing a clothing item photo for a wardrobe app. ` +
    `Respond with ONLY a JSON object — no markdown, no explanation — in exactly this format:\n` +
    `{\n` +
    `  "name": "concise descriptive name, e.g. Navy linen blazer",\n` +
    `  "category": "one of: Tops | Bottoms | Dresses | Outerwear | Shoes | Accessories | Bags",\n` +
    `  "colour": "colour description, e.g. Dusty rose",\n` +
    `  "seasons": ["one or more of: Spring, Summer, Autumn, Winter"]\n` +
    `}`

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
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text()
      console.error('Anthropic error:', err)
      return res.status(anthropicRes.status).json({ error: 'Anthropic API error', detail: err })
    }

    const data   = await anthropicRes.json()
    const text   = data?.content?.[0]?.text ?? ''
    const match  = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in response')

    const parsed = JSON.parse(match[0])

    // Sanitise — fall back to safe defaults if Claude returns unexpected values
    const result = {
      name:     typeof parsed.name === 'string'     ? parsed.name.trim()    : '',
      category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'Tops',
      colour:   typeof parsed.colour === 'string'   ? parsed.colour.trim()  : '',
      seasons:  Array.isArray(parsed.seasons)
                  ? parsed.seasons.filter(s => VALID_SEASONS.includes(s))
                  : [],
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error('analyze-item.js error:', err)
    return res.status(500).json({ error: err.message })
  }
}
