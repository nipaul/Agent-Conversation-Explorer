import { useEffect, useState } from 'react'
import ConversationList from './components/ConversationList'
import ConversationDetail from './components/ConversationDetail'
import SettingsMenu, { type Theme } from './components/SettingsMenu'
import type { ConversationSummary } from './types'

export default function App() {
  const [selected, setSelected] = useState<ConversationSummary | null>(null)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    const initial = saved ?? 'midnight'
    document.documentElement.setAttribute('data-theme', initial)
    return initial
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">
          Agent Conversation Explorer
          <span className="beta-badge">Beta</span>
        </span>
        <SettingsMenu theme={theme} onThemeChange={setTheme} />
      </header>
      <div className="app-body">
        <aside className="conv-panel">
          <ConversationList onSelect={setSelected} selected={selected} />
        </aside>
        <main className="detail-panel">
          {selected ? (
            <ConversationDetail conversation={selected} />
          ) : (
            <div className="empty-state">Select a conversation to explore</div>
          )}
        </main>
      </div>
    </div>
  )
}
