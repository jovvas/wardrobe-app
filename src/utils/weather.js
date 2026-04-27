// ── WMO weather code → human description ──────────────────────
const WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Heavy rain showers', 82: 'Violent rain showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
}
export const wmoToDesc = (code) =>
  WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? 'Variable conditions'

// ── Browser geolocation ────────────────────────────────────────
export const getUserCoords = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported by this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000, maximumAge: 300_000 }
    )
  })

// ── Reverse geocode lat/lon → city name (BigDataCloud, free, no key) ──
export const reverseGeocode = async (lat, lon) => {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    )
    const d = await res.json()
    return {
      city: d.city || d.locality || d.principalSubdivision || null,
      country: d.countryName || null,
    }
  } catch {
    return { city: null, country: null }
  }
}

// ── Forward geocode city name → lat/lon (Open-Meteo, free, no key) ──
export const geocodeCity = async (name) => {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`
    )
    const d = await res.json()
    const r = d.results?.[0]
    if (!r) return null
    return { lat: r.latitude, lon: r.longitude, city: r.name, country: r.country }
  } catch {
    return null
  }
}

// ── 8-day daily forecast (Open-Meteo, free, no key) ───────────
export const fetchForecast = async (lat, lon) => {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max` +
    `&timezone=auto&forecast_days=8`
  )
  return res.json()
}

// ── Format forecast into a string for the AI system prompt ────
export const formatForecastForAI = (city, country, forecast) => {
  const { daily } = forecast
  if (!daily?.time) return null
  const today = new Date().toDateString()
  const lines = daily.time.map((dateStr, i) => {
    const d = new Date(dateStr + 'T12:00:00') // noon to avoid timezone issues
    const isToday    = d.toDateString() === today
    const isTomorrow = new Date(Date.now() + 86400_000).toDateString() === d.toDateString()
    const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow'
      : d.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })
    const min  = Math.round(daily.temperature_2m_min[i])
    const max  = Math.round(daily.temperature_2m_max[i])
    const desc = wmoToDesc(daily.weathercode[i])
    const rain = daily.precipitation_probability_max?.[i]
    return `  ${label}: ${desc}, ${min}–${max}°C${rain != null ? `, ${rain}% rain chance` : ''}`
  })
  const location = [city, country].filter(Boolean).join(', ')
  return `Weather forecast for ${location}:\n${lines.join('\n')}`
}

// ── Extract a city name from a user message ────────────────────
// Looks for patterns like "in Belgrade", "to Paris", "at London"
const SKIP_WORDS = new Set([
  'a', 'an', 'the', 'my', 'our', 'your', 'this', 'that', 'next', 'last',
  'work', 'home', 'office', 'school', 'some', 'any', 'no',
  'summer', 'winter', 'spring', 'autumn', 'fall',
  'week', 'weekend', 'morning', 'evening', 'night', 'day', 'time',
  'tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april',
  'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
])

export const extractCityFromText = (text) => {
  const matches = [...text.matchAll(/\b(?:in|to|at)\s+([A-Za-z][a-z]+(?:\s+[A-Z][a-z]+)?)/g)]
  for (const m of matches) {
    const candidate = m[1].trim()
    if (candidate.length >= 3 && !SKIP_WORDS.has(candidate.toLowerCase())) {
      return candidate
    }
  }
  return null
}

// ── Module-level cache so geolocation runs only once per session ──
let _cache = null  // { city, country, lat, lon, context }

export const getLocationAndWeather = async () => {
  if (_cache) return _cache
  const coords = await getUserCoords()
  const [geo, forecast] = await Promise.all([
    reverseGeocode(coords.lat, coords.lon),
    fetchForecast(coords.lat, coords.lon),
  ])
  const city    = geo.city
  const country = geo.country
  const context = formatForecastForAI(city, country, forecast)
  _cache = { lat: coords.lat, lon: coords.lon, city, country, context }
  return _cache
}

// Bust the cache (e.g. if location permission changes)
export const clearLocationCache = () => { _cache = null }
