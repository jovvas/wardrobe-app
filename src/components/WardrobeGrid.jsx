import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient.js'

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags']

const PLACEHOLDER_EMOJI = {
  Tops: '👕', Bottoms: '👖', Dresses: '👗', Outerwear: '🧥',
  Shoes: '👟', Accessories: '💍', Bags: '👜',
}

export default function WardrobeGrid() {
  const [items,   setItems]   = useState([])
  const [filter,  setFilter]  = useState('All')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('wardrobe_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setItems(data ?? [])
    }
    setLoading(false)
  }

  const deleteItem = async (item) => {
    if (!window.confirm(`Remove "${item.name}" from your wardrobe?`)) return

    // Delete photo from storage if it exists
    if (item.photo_url) {
      // Extract the filename from the public URL
      const parts = item.photo_url.split('/wardrobe-photos/')
      if (parts[1]) {
        await supabase.storage.from('wardrobe-photos').remove([parts[1]])
      }
    }

    const { error: err } = await supabase
      .from('wardrobe_items')
      .delete()
      .eq('id', item.id)
    if (err) {
      alert('Could not delete item: ' + err.message)
    } else {
      setItems(prev => prev.filter(i => i.id !== item.id))
    }
  }

  const visible = filter === 'All' ? items : items.filter(i => i.category === filter)

  return (
    <div>
      <h1 className="page-title">
        Wardrobe
        {!loading && <span className="text-muted" style={{ fontSize: 14, fontWeight: 400, marginLeft: 8 }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>}
      </h1>

      {error && <div className="banner banner-error">{error}</div>}

      {/* Category filter chips */}
      <div className="filter-bar">
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`filter-chip${filter === c ? ' active' : ''}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && (
        <div className="empty">
          <p>Loading your wardrobe…</p>
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="empty">
          <div className="empty-icon">👗</div>
          <p>
            {filter === 'All'
              ? 'Your wardrobe is empty.\nTap ➕ Add Item to get started.'
              : `No ${filter.toLowerCase()} added yet.`}
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="wardrobe-grid">
          {visible.map(item => (
            <div key={item.id} className="item-card">
              <button
                className="item-card-delete"
                onClick={() => deleteItem(item)}
                title="Remove item"
              >
                ✕
              </button>
              {item.photo_url ? (
                <img src={item.photo_url} alt={item.name} loading="lazy" />
              ) : (
                <div className="item-card-placeholder">
                  {PLACEHOLDER_EMOJI[item.category] ?? '👔'}
                </div>
              )}
              <div className="item-card-body">
                <div className="item-card-name">{item.name}</div>
                <div className="item-card-meta">{item.colour}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
