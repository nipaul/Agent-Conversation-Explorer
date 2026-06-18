import { useEffect, useState } from 'react'
import { getAppStatus } from '../api'
import type { AuthStatus, AppStatus } from '../types'

interface Props {
  auth: AuthStatus | null
  refreshSignal?: number
}

export default function AppFooter({ auth, refreshSignal }: Props) {
  const [app, setApp] = useState<AppStatus | null>(null)

  useEffect(() => {
    getAppStatus().then(setApp).catch(() => {})
  }, [refreshSignal])

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
