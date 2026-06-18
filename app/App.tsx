import { useEffect, useRef, useState } from 'react'
import ConversationList from './components/ConversationList'
import ConversationDetail from './components/ConversationDetail'
import ErrorBoundary from './components/ErrorBoundary'
import SettingsMenu, { type Theme } from './components/SettingsMenu'
import AppFooter from './components/AppFooter'
import { getAuthStatus } from './api'
import type { AuthStatus, ConversationSummary } from './types'

const AUTH_POLL_MS = 120_000

export default function App() {
  const [selected, setSelected] = useState<ConversationSummary | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [listRefreshSignal, setListRefreshSignal] = useState(0)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  function refreshAuth() {
    getAuthStatus().then(setAuth).catch(() => {})
  }

  useEffect(() => {
    refreshAuth()
    refreshTimerRef.current = setInterval(refreshAuth, AUTH_POLL_MS)
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current) }
  }, [])

  function handleAuthChange() {
    refreshAuth()
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    refreshTimerRef.current = setInterval(refreshAuth, AUTH_POLL_MS)
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">
          Agent Conversation Explorer
          <span className="beta-badge">Beta</span>
        </span>
        <SettingsMenu theme={theme} onThemeChange={setTheme} open={settingsOpen} onOpenChange={setSettingsOpen} onAuthChange={handleAuthChange} onConnectionChange={() => setListRefreshSignal(s => s + 1)} />
      </header>
      <div className="app-body">
        <aside className="conv-panel">
          <ConversationList onSelect={setSelected} selected={selected} onOpenSettings={() => setSettingsOpen(true)} refreshSignal={listRefreshSignal} />
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
      <AppFooter auth={auth} refreshSignal={listRefreshSignal} />
    </div>
  )
}
