import { useEffect, useState } from 'react'
import ConversationList from './components/ConversationList'
import ConversationDetail from './components/ConversationDetail'
import ErrorBoundary from './components/ErrorBoundary'
import SettingsMenu, { type Theme } from './components/SettingsMenu'
import AppFooter from './components/AppFooter'
import type { ConversationSummary } from './types'

export default function App() {
  const [selected, setSelected] = useState<ConversationSummary | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
        <SettingsMenu theme={theme} onThemeChange={setTheme} open={settingsOpen} onOpenChange={setSettingsOpen} />
      </header>
      <div className="app-body">
        <aside className="conv-panel">
          <ConversationList onSelect={setSelected} selected={selected} onOpenSettings={() => setSettingsOpen(true)} />
        </aside>
        <main className="detail-panel">
          {selected ? (
            <ErrorBoundary key={selected.conversationId}>
              <ConversationDetail conversation={selected} />
            </ErrorBoundary>
          ) : (
            <div className="empty-state">Select a conversation to explore</div>
          )}
        </main>
      </div>
      <AppFooter />
    </div>
  )
}
