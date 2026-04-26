import { useState } from 'react'
import WardrobeGrid    from './components/WardrobeGrid.jsx'
import AddItem         from './components/AddItem.jsx'
import OutfitSuggester from './components/OutfitSuggester.jsx'
import OutfitLog       from './components/OutfitLog.jsx'

const TABS = [
  { id: 'wardrobe',  label: 'Wardrobe', icon: '👗' },
  { id: 'add',       label: 'Add Item', icon: '➕' },
  { id: 'outfits',   label: 'Outfits',  icon: '✨' },
  { id: 'log',       label: 'Log',      icon: '📅' },
]

export default function App() {
  const [tab,        setTab]        = useState('wardrobe')
  const [refreshKey, setRefreshKey] = useState(0)

  // Outfit chat state lifted here so it survives tab switches
  const [chatMessages, setChatMessages] = useState([])
  const [chatWardrobe, setChatWardrobe] = useState(null)

  const refresh = () => setRefreshKey(k => k + 1)

  const handleItemAdded = () => {
    refresh()
    setTab('wardrobe')
  }

  return (
    <div className="app">
      <div className="screen">
        {tab === 'wardrobe' && <WardrobeGrid key={refreshKey} />}
        {tab === 'add'      && <AddItem onAdded={handleItemAdded} />}
        {tab === 'outfits'  && (
          <OutfitSuggester
            messages={chatMessages}
            setMessages={setChatMessages}
            wardrobe={chatWardrobe}
            setWardrobe={setChatWardrobe}
          />
        )}
        {tab === 'log'      && <OutfitLog key={refreshKey} />}
      </div>

      <nav className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
