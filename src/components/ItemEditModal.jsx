import { useState } from 'react'
import { supabase } from '../supabaseClient.js'

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags']

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

export default function ItemEditModal({ item, onSave, onClose }) {
  const [form,    setForm]    = useState({
    name:     item.name     ?? '',
    category: item.category ?? 'Tops',
    colour:   item.colour   ?? '',
    brand:    item.brand    ?? '',
  })
  const [newPhoto,  setNewPhoto]  = useState(null)   // { blob, previewUrl }
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const blob       = await resizeImage(file)
    const previewUrl = URL.createObjectURL(blob)
    setNewPhoto({ blob, previewUrl })
  }

  const handleSave = async () => {
    setError(null)
    if (!form.name.trim())   return setError('Item name is required.')
    if (!form.colour.trim()) return setError('Colour is required.')

    setLoading(true)
    try {
      let photo_url = item.photo_url ?? null

      if (newPhoto?.blob) {
        // Upload new photo
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('wardrobe-photos')
          .upload(filename, newPhoto.blob, { contentType: 'image/jpeg' })
        if (uploadErr) throw uploadErr

        // Delete old photo if there was one
        if (item.photo_url) {
          const parts = item.photo_url.split('/wardrobe-photos/')
          if (parts[1]) await supabase.storage.from('wardrobe-photos').remove([parts[1]])
        }

        const { data: urlData } = supabase.storage
          .from('wardrobe-photos')
          .getPublicUrl(filename)
        photo_url = urlData.publicUrl
      }

      const { error: updateErr } = await supabase
        .from('wardrobe_items')
        .update({
          name:      form.name.trim(),
          category:  form.category,
          colour:    form.colour.trim(),
          brand:     form.brand.trim() || null,
          photo_url,
        })
        .eq('id', item.id)
      if (updateErr) throw updateErr

      onSave({ ...item, ...form, name: form.name.trim(), colour: form.colour.trim(), brand: form.brand.trim() || null, photo_url })
    } catch (err) {
      setError(err.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const currentPhoto = newPhoto?.previewUrl ?? item.photo_url

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />

        <div className="modal-header">
          <h2 className="modal-title">Edit Item</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="banner banner-error">{error}</div>}

          {/* Photo */}
          <div className="form-group">
            <label>Photo</label>
            {currentPhoto ? (
              <div>
                <img src={currentPhoto} alt="item" className="photo-preview" />
                <label className="photo-upload-label mt-8" style={{ marginTop: 8 }}>
                  📷 Replace photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
                </label>
              </div>
            ) : (
              <label className="photo-upload-label">
                📷 Add photo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
              </label>
            )}
          </div>

          <div className="form-group">
            <label>Item name</label>
            <input type="text" value={form.name} onChange={set('name')} maxLength={80} />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={set('category')}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Colour</label>
            <input type="text" value={form.colour} onChange={set('colour')} maxLength={40} />
          </div>

          <div className="form-group">
            <label>Brand <span className="text-muted">(optional)</span></label>
            <input type="text" value={form.brand} onChange={set('brand')} maxLength={60} />
          </div>

          <button className="btn btn-primary mt-8" onClick={handleSave} disabled={loading}>
            {loading ? <><span className="spinner" /> Saving…</> : '💾 Save changes'}
          </button>

          <button className="btn btn-ghost mt-8" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
