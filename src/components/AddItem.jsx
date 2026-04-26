import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient.js'

const CATEGORIES = ['Short Sleeve', 'Long Sleeve', 'Pants', 'Shorts', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags']

const EMOJI = {
  'Short Sleeve': '👕', 'Long Sleeve': '👕', Pants: '👖', Shorts: '🩳', Dresses: '👗', Outerwear: '🧥',
  Shoes: '👟', Accessories: '💍', Bags: '👜',
}

// Resize + compress an image file to a JPEG blob ≤ ~800 px wide
function resizeImage(file, maxWidth = 800) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale   = Math.min(1, maxWidth / img.width)
      const canvas  = document.createElement('canvas')
      canvas.width  = img.width  * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    }
    img.src = url
  })
}

// Convert a Blob to base64 string (without the data: prefix)
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.readAsDataURL(blob)
  })
}

const EMPTY = { name: '', category: 'Short Sleeve', colour: '', brand: '' }

export default function AddItem({ onAdded }) {
  const [form,      setForm]      = useState(EMPTY)
  const [photo,     setPhoto]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [error,     setError]     = useState(null)
  const [aiNote,    setAiNote]    = useState(null)
  const fileRef = useRef()

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const blob       = await resizeImage(file)
    const previewUrl = URL.createObjectURL(blob)
    setPhoto({ file, previewUrl, blob })
    setAiNote(null)

    // Trigger AI analysis
    setAnalysing(true)
    try {
      const base64 = await blobToBase64(blob)
      const res    = await fetch('/api/analyze-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg' }),
      })
      if (res.ok) {
        const data = await res.json()
        setForm(f => ({
          ...f,
          name:     data.name     || f.name,
          category: data.category || f.category,
          colour:   data.colour   || f.colour,
          brand:    data.brand    || f.brand,
        }))
        setAiNote('Fields pre-filled by AI — check and adjust if needed.')
      }
    } catch {
      // Silent fail — user can fill in manually
    } finally {
      setAnalysing(false)
    }
  }

  const removePhoto = () => {
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl)
    setPhoto(null)
    setAiNote(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim())   return setError('Please enter an item name.')
    if (!form.colour.trim()) return setError('Please enter a colour.')

    setLoading(true)
    try {
      let photo_url = null

      if (photo?.blob) {
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('wardrobe-photos')
          .upload(filename, photo.blob, { contentType: 'image/jpeg' })
        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('wardrobe-photos')
          .getPublicUrl(filename)
        photo_url = urlData.publicUrl
      }

      const { error: insertErr } = await supabase
        .from('wardrobe_items')
        .insert({
          name:     form.name.trim(),
          category: form.category,
          colour:   form.colour.trim(),
          brand:    form.brand.trim() || null,
          photo_url,
        })
      if (insertErr) throw insertErr

      removePhoto()
      setForm(EMPTY)
      onAdded?.()
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="page-title">Add Item</h1>

      {error  && <div className="banner banner-error">{error}</div>}
      {aiNote && <div className="banner banner-info">✨ {aiNote}</div>}

      {/* Photo upload — goes first so AI can pre-fill fields below */}
      <div className="form-group">
        <label>Photo {analysing && <span className="text-muted">(analysing…)</span>}</label>
        {photo ? (
          <div>
            <img src={photo.previewUrl} alt="preview" className="photo-preview" />
            <button type="button" className="btn btn-ghost mt-8" onClick={removePhoto}>
              Remove photo
            </button>
          </div>
        ) : (
          <label className="photo-upload-label">
            📷 Choose from camera roll
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </label>
        )}
      </div>

      <div className="form-group">
        <label>Item name</label>
        <input
          type="text"
          placeholder="e.g. Navy linen blazer"
          value={form.name}
          onChange={e => set('name')(e.target.value)}
          maxLength={80}
        />
      </div>

      <div className="form-group">
        <label>Category</label>
        <select value={form.category} onChange={e => set('category')(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Colour</label>
        <input
          type="text"
          placeholder="e.g. Navy blue"
          value={form.colour}
          onChange={e => set('colour')(e.target.value)}
          maxLength={40}
        />
      </div>

      <div className="form-group">
        <label>Brand <span className="text-muted">(optional)</span></label>
        <input
          type="text"
          placeholder="e.g. Zara, Mango, H&M"
          value={form.brand}
          onChange={e => set('brand')(e.target.value)}
          maxLength={60}
        />
      </div>

      <button
        className="btn btn-primary mt-8"
        type="submit"
        disabled={loading || analysing}
      >
        {loading
          ? <><span className="spinner" /> Saving…</>
          : analysing
          ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Analysing photo…</>
          : `${EMOJI[form.category] ?? '➕'} Save item`}
      </button>
    </form>
  )
}
