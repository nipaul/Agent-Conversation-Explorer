import { useEffect, useState } from 'react'
import { getAuthStatus, getAppStatus } from '../api'
import type { AuthStatus, AppStatus } from '../types'

export default function AppFooter() {
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [app, setApp] = useState<AppStatus | null>(null)

  useEffect(() => {
    getAppStatus().then(setApp).catch(() => {})

    function refreshAuth() {
      getAuthStatus().then(setAuth).catch(() => {})
    }
    refreshAuth()
    const id = setInterval(refreshAuth, 120_000)
    return () => clearInterval(id)
  }, [])

  const tenantLabel =
    auth?.tenantDisplayName ??
    (auth?.tenantId ? auth.tenantId.slice(0, 8) + '…' : null)

  const appLabel = app
    ? [app.region, app.appId.slice(0, 8) + '…'].filter(Boolean).join(' · ')
    : null

  return (
    <footer className="app-footer">
      <span className={`footer-auth-dot${auth?.loggedIn ? ' ok' : ' err'}`} />
      <span className="footer-item">
        {auth?.loggedIn ? auth.name : 'Not signed in'}
      </span>
      {auth?.loggedIn && auth.subscription && (
        <span className="footer-item footer-sep">{auth.subscription}</span>
      )}
      {auth?.loggedIn && tenantLabel && (
        <span className="footer-item footer-sep">{tenantLabel}</span>
      )}
      {appLabel && (
        <span className="footer-item footer-sep footer-app-insights">
          App Insights: {appLabel}
        </span>
      )}
    </footer>
  )
}
