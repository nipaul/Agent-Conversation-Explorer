import { useEffect, useRef, useState } from 'react'
import ConversationList from './components/ConversationList'
import ConversationDetail from './components/ConversationDetail'
import ErrorBoundary from './components/ErrorBoundary'
import SettingsMenu, { type Theme } from './components/SettingsMenu'
import AppFooter from './components/AppFooter'
import { ApiError, getAuthStatus, getSettings } from './api'
import type { AuthStatus, ConversationSummary } from './types'
import { logAction, logWarn, setClientLogLevel } from './utils/logger'

const AUTH_POLL_MS = 120_000

export default function App() {
  const [selected, setSelected] = useState<ConversationSummary | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [azureOnline, setAzureOnline] = useState<boolean | null>(null)
  const [listRefreshSignal, setListRefreshSignal] = useState(0)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevBackendOnline = useRef<boolean | null>(null)
  const prevAzureOnline = useRef<boolean | null>(null)

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

  useEffect(() => {
    if (backendOnline === false && prevBackendOnline.current !== false)
      logWarn('App', 'backend.unreachable')
    else if (backendOnline === true && prevBackendOnline.current === false)
      logAction('App', 'backend.restored')
    prevBackendOnline.current = backendOnline
  }, [backendOnline])

  useEffect(() => {
    if (azureOnline === false && prevAzureOnline.current !== false)
      logWarn('App', 'azure.unreachable')
    else if (azureOnline === true && prevAzureOnline.current === false)
      logAction('App', 'azure.restored')
    prevAzureOnline.current = azureOnline
  }, [azureOnline])

  function refreshAuth() {
    getAuthStatus()
      .then(data => { setAuth(data); setBackendOnline(true) })
      .catch(e => {
        if (e instanceof ApiError && e.code === 'NETWORK') {
          setBackendOnline(false)
        } else {
          setBackendOnline(true) // HTTP error means server responded
        }
      })
  }

  function retryNow() {
    refreshAuth()
    setListRefreshSignal(s => s + 1)
  }

  function handleFetchStatus(err: unknown | null) {
    if (err === null) {
      setAzureOnline(true)
    } else if (err instanceof ApiError && err.code === 'UPSTREAM_ERROR') {
      setAzureOnline(false)
    }
    // NETWORK errors are already handled by refreshAuth via backendOnline
    // AUTH_REQUIRED has its own inline UX in ErrorState
  }

  useEffect(() => {
    refreshAuth()
    getSettings().then(s => setClientLogLevel(s.LOG_LEVEL)).catch(() => {})
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
      {(backendOnline === false || azureOnline === false) && (
        <div className="backend-banner" role="alert">
          <span className="backend-banner-msg">
            {backendOnline === false
              ? 'Backend server unreachable — conversations cannot load.'
              : 'App Insights unreachable — check network connectivity.'}
          </span>
          <button className="backend-banner-retry" onClick={retryNow}>Retry</button>
        </div>
      )}
      <div className="app-body">
        <aside className="conv-panel">
          <ConversationList onSelect={setSelected} selected={selected} onOpenSettings={() => setSettingsOpen(true)} refreshSignal={listRefreshSignal} onFetchStatus={handleFetchStatus} />
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
      <AppFooter auth={auth} refreshSignal={listRefreshSignal} backendOnline={backendOnline} onRetry={retryNow} />
    </div>
  )
}
