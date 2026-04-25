import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient.js'

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags']
const FORMALITY  = ['Casual', 'Smart-Casual', 'Business', 'Formal']
const SEASONS    = ['All-Season', 'Spring', 'Summer', 'Autumn', 'Winter']

const EMOJI = {
  Tops: '👕', Bottoms: '👖', Dresses: '👗', Outerwear: '🧥',
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

const EMPTY = { name: '', category: 'Tops', colour: '', formality: 'Casual', season: 'All-Season' }

export default function AddItem({ onAdded }) {
  const [form,    setForm]    = useState(EMPTY)
  const [photo,   setPhoto]   = useState(null)   // { file, previewUrl }
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const fileRef = useRef()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setPhoto({ file, previewUrl })
  }

  const removePhoto = () => {
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl)
    setPhoto(null)
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

      if (photo?.file) {
        const blob     = await resizeImage(photo.file)
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('wardrobe-photos')
          .upload(filename, blob, { contentType: 'image/jpeg' })
        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('wardrobe-photos')
          .getPublicUrl(filename)
        photo_url = urlData.publicUrl
      }

      const { error: insertErr } = await supabase
        .from('wardrobe_items')
        .insert({ ...form, name: form.name.trim(), colour: form.colour.trim(), photo_url })
      if (insertErr) throw insertErr

      // Reset
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

      {error && <div className="banner banner-error">{error}</div>}

      <div className="form-group">
        <label>Item name</label>
        <input
          type="text"
          placeholder="e.g. Navy linen blazer"
          value={form.name}
          onChange={set('name')}
          maxLength={80}
        />
      </div>

      <div className="form-group">
        <label>Category</label>
        <select value={form.category} onChange={set('category')}>
          {CATEGORIES.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Colour</label>
        <input
          type="text"
          placeholder="e.g. Navy blue"
          value={form.colour}
          onChange={set('colour')}
          maxLength={40}
        />
      </div>

      <div className="form-group">
        <label>Formality</label>
        <select value={form.formality} onChange={set('formality')}>
          {FORMALITY.map(f => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Season</label>
        <select value={form.season} onChange={set('season')}>
          {SEASONS.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Photo (optional)</label>
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

      <button className="btn btn-primary mt-8" type="submit" disabled={loading}>
        {loading ? <><span className="spinner" /> Saving…</> : `${EMOJI[form.category] ?? '➕'} Save item`}
      </button>
    </form>
  )
}
