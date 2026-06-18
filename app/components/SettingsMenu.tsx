import { useEffect, useRef, useState } from 'react'
import { getAuthStatus, startAzureLogin, logoutAzure, getSettings, saveSettings, testConnection, browseFolder } from '../api'
import type { AuthStatus, DeviceCodeInfo, EnvSettings, ConnectionTestResult } from '../types'

export type Theme = 'midnight' | 'ivory'

const THEMES: { id: Theme; label: string; colors: [string, string, string] }[] = [
  { id: 'midnight', label: 'Midnight',      colors: ['#f0f0f0', '#1e1e2e', '#7c3aed'] },
  { id: 'ivory',    label: 'Sand Beach', colors: ['#F2EBD9', '#E0D4BA', '#9E7A00'] },
]

interface Props {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SettingsMenu({ theme, onThemeChange, open, onOpenChange }: Props) {
  const setOpen = onOpenChange
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Security section
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [loginInProgress, setLoginInProgress] = useState(false)
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [connStrDraft, setConnStrDraft] = useState('')
  const [connStrSaving, setConnStrSaving] = useState(false)
  const [connStrSaved, setConnStrSaved] = useState(false)
  const [connStrError, setConnStrError] = useState<string | null>(null)
  const [connTestResult, setConnTestResult] = useState<ConnectionTestResult | null>(null)
  const [connTesting, setConnTesting] = useState(false)
  const [switchingAccount, setSwitchingAccount] = useState(false)

  // Logging section
  const [logDraft, setLogDraft] = useState<Pick<EnvSettings, 'LOG_LEVEL' | 'LOG_PATH'> | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [logSaving, setLogSaving] = useState(false)
  const [logSaved, setLogSaved] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Poll auth status while device code is pending, stop when logged in or panel closes
  useEffect(() => {
    if (!deviceCode || !open) return
    const INTERVAL_MS = 10_000
    const TIMEOUT_MS = 5 * 60_000
    const started = Date.now()

    const id = setInterval(async () => {
      if (Date.now() - started > TIMEOUT_MS) {
        clearInterval(id)
        setAuthError('Sign-in timed out. Please try again.')
        setDeviceCode(null)
        return
      }
      try {
        const s = await getAuthStatus()
        if (s.loggedIn) {
          clearInterval(id)
          setAuthStatus(s)
          setDeviceCode(null)
        }
      } catch {
        // ignore transient errors, keep polling
      }
    }, INTERVAL_MS)

    return () => clearInterval(id)
  }, [deviceCode, open])

  const [refreshing, setRefreshing] = useState(false)

  function loadAll() {
    setAuthLoading(true)
    setAuthError(null)
    setDeviceCode(null)
    getAuthStatus()
      .then(s => setAuthStatus(s))
      .catch(err => setAuthError((err as Error).message))
      .finally(() => setAuthLoading(false))

    setSettingsLoading(true)
    setLogError(null)
    getSettings()
      .then(s => {
        setConnStrDraft(s.TELEMETRY_CONNECTION_STRING)
        setLogDraft({ LOG_LEVEL: s.LOG_LEVEL, LOG_PATH: s.LOG_PATH })
      })
      .catch(err => setLogError((err as Error).message))
      .finally(() => setSettingsLoading(false))
  }

  useEffect(() => { if (open) loadAll() }, [open])

  async function handleRefresh() {
    setRefreshing(true)
    loadAll()
    setTimeout(() => setRefreshing(false), 800)
  }

  async function handleLogin() {
    setLoginInProgress(true)
    setAuthError(null)
    setDeviceCode(null)
    try {
      const info = await startAzureLogin()
      setDeviceCode(info)
      if (info.loggedIn) setAuthStatus({ loggedIn: true })
    } catch (err) {
      setAuthError((err as Error).message)
    } finally {
      setLoginInProgress(false)
    }
  }

  async function handleCheckStatus() {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const s = await getAuthStatus()
      setAuthStatus(s)
      if (s.loggedIn) setDeviceCode(null)
    } catch (err) {
      setAuthError((err as Error).message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSwitchAccount() {
    setSwitchingAccount(true)
    setAuthError(null)
    setDeviceCode(null)
    try {
      await logoutAzure()
      setAuthStatus({ loggedIn: false })
      const info = await startAzureLogin()
      setDeviceCode(info)
      if (info.loggedIn) {
        const s = await getAuthStatus()
        setAuthStatus(s)
        setDeviceCode(null)
      }
    } catch (err) {
      setAuthError((err as Error).message)
    } finally {
      setSwitchingAccount(false)
    }
  }

  async function handleTestConnection() {
    setConnTesting(true)
    setConnTestResult(null)
    try {
      const result = await testConnection(connStrDraft)
      setConnTestResult(result)
    } catch (err) {
      setConnTestResult({ ok: false, message: (err as Error).message })
    } finally {
      setConnTesting(false)
    }
  }

  async function handleSaveConnStr() {
    setConnStrSaving(true)
    setConnStrError(null)
    setConnStrSaved(false)
    try {
      await saveSettings({ TELEMETRY_CONNECTION_STRING: connStrDraft })
      setConnStrSaved(true)
      setTimeout(() => setConnStrSaved(false), 3000)
    } catch (err) {
      setConnStrError((err as Error).message)
    } finally {
      setConnStrSaving(false)
    }
  }

  async function handleBrowseFolder() {
    setBrowsing(true)
    try {
      const result = await browseFolder()
      if (!result.cancelled && result.path) {
        setLogDraft(d => d ? { ...d, LOG_PATH: result.path! } : d)
      }
    } catch (err) {
      setLogError((err as Error).message)
    } finally {
      setBrowsing(false)
    }
  }

  async function handleSaveLogging() {
    if (!logDraft) return
    setLogSaving(true)
    setLogError(null)
    setLogSaved(false)
    try {
      await saveSettings({ LOG_LEVEL: logDraft.LOG_LEVEL, LOG_PATH: logDraft.LOG_PATH })
      setLogSaved(true)
      setTimeout(() => setLogSaved(false), 3000)
    } catch (err) {
      setLogError((err as Error).message)
    } finally {
      setLogSaving(false)
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        className={`settings-btn${open ? ' open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Settings"
      >
        <span aria-hidden="true">⚙</span>
        <span>Settings</span>
      </button>

      {open && (
        <>
          <div className="settings-overlay" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={panelRef} className="settings-panel" role="dialog" aria-label="Settings">
          <div className="settings-breadcrumb">
            <span className="settings-icon">⚙</span>
            <span className="breadcrumb-seg active">Settings</span>
            <button
              className="settings-refresh-btn"
              onClick={handleRefresh}
              disabled={refreshing || authLoading || settingsLoading}
              aria-label="Refresh settings"
              title="Refresh"
            >
              {refreshing ? '↻' : '↻'}
            </button>
            <button
              className="settings-close-btn"
              onClick={() => setOpen(false)}
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>

          {/* ── Theme ── */}
          <div className="settings-body">
            <div className="settings-section-label">Theme</div>
            <div className="theme-grid">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-card${theme === t.id ? ' selected' : ''}`}
                  onClick={() => { onThemeChange(t.id); setOpen(false) }}
                >
                  <div className="theme-swatch">
                    <div className="swatch-sidebar" style={{ background: t.colors[1] }} />
                    <div className="swatch-main" style={{ background: t.colors[0] }}>
                      <div className="swatch-dot" style={{ background: t.colors[2] }} />
                    </div>
                  </div>
                  <div className="theme-card-footer">
                    <span className="theme-card-name">{t.label}</span>
                    {theme === t.id && <span className="theme-card-tick">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-divider" />

          {/* ── Security ── */}
          <div className="settings-body">
            <div className="settings-section-label">Security</div>

            {authLoading && <div className="config-loading">Checking Azure login…</div>}

            {!authLoading && authStatus && (
              <div className={`auth-status${authStatus.loggedIn ? ' logged-in' : ' logged-out'}`}>
                <span className="auth-dot" />
                <span className="auth-status-text">
                  {authStatus.loggedIn
                    ? <>{authStatus.name}{authStatus.subscription && <span className="auth-sub"> — {authStatus.subscription}</span>}</>
                    : 'Not authenticated'
                  }
                </span>
              </div>
            )}

            {authError && <div className="config-error">{authError}</div>}

            {!authLoading && authStatus && !authStatus.loggedIn && !deviceCode && (
              <button className="auth-btn" onClick={handleLogin} disabled={loginInProgress}>
                {loginInProgress ? 'Starting login…' : 'Login with Azure'}
              </button>
            )}

            {!authLoading && authStatus?.loggedIn && (
              <div className="auth-action-row">
                <button className="auth-btn secondary" onClick={handleCheckStatus} disabled={authLoading}>
                  Refresh
                </button>
                <button className="auth-btn secondary" onClick={handleSwitchAccount} disabled={switchingAccount}>
                  {switchingAccount ? 'Switching…' : 'Switch Account'}
                </button>
              </div>
            )}

            {deviceCode?.deviceCodeUrl && (
              <div className="auth-device-code">
                <div className="auth-device-label">Open in your browser:</div>
                <a href={deviceCode.deviceCodeUrl} target="_blank" rel="noreferrer" className="auth-device-url">
                  {deviceCode.deviceCodeUrl}
                </a>
                <div className="auth-device-label">Enter this code:</div>
                <div className="auth-code-row">
                  <span className="auth-code">{deviceCode.userCode}</span>
                  <button className="auth-copy-btn" onClick={() => navigator.clipboard.writeText(deviceCode.userCode ?? '')}>
                    Copy
                  </button>
                </div>
                <div className="auth-polling-status">
                  <span className="auth-polling-dot" />
                  Waiting for sign-in…
                </div>
              </div>
            )}

            <div className="config-field" style={{ marginTop: 14 }}>
              <label className="config-label" htmlFor="cfg-connstr">Connection String</label>
              {settingsLoading
                ? <div className="config-loading">Loading…</div>
                : <textarea
                    id="cfg-connstr"
                    className="config-textarea"
                    rows={5}
                    value={connStrDraft}
                    onChange={e => { setConnStrDraft(e.target.value); setConnTestResult(null) }}
                    spellCheck={false}
                  />
              }
            </div>
            {connStrError && <div className="config-error">{connStrError}</div>}
            {connStrSaved && <div className="config-success">Saved.</div>}
            {connTestResult && (
              <div className={connTestResult.ok ? 'config-success' : 'config-error'}>
                {connTestResult.ok ? '✓ Connection verified — this identity has access.' : `✗ ${connTestResult.message}`}
              </div>
            )}
            <div className="config-hint" style={{ marginBottom: 8 }}>Requires server restart to take effect.</div>
            <div className="conn-btn-row">
              <button
                className="auth-btn secondary"
                onClick={handleTestConnection}
                disabled={connTesting || settingsLoading || !connStrDraft.trim()}
              >
                {connTesting ? 'Testing…' : 'Test Connection'}
              </button>
              <button
                className="config-save-btn conn-save"
                onClick={handleSaveConnStr}
                disabled={connStrSaving || settingsLoading}
              >
                {connStrSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="settings-divider" />

          {/* ── Logging ── */}
          <div className="settings-body">
            <div className="settings-section-label">Logging</div>

            {settingsLoading && <div className="config-loading">Loading…</div>}

            {!settingsLoading && logDraft && (
              <>
                <div className="config-field">
                  <label className="config-label" htmlFor="cfg-loglevel">Log Level</label>
                  <select
                    id="cfg-loglevel"
                    className="config-select"
                    value={logDraft.LOG_LEVEL}
                    onChange={e => setLogDraft(d => d ? { ...d, LOG_LEVEL: e.target.value } : d)}
                  >
                    <option value="debug">debug</option>
                    <option value="info">info</option>
                    <option value="warn">warn</option>
                    <option value="error">error</option>
                  </select>
                </div>

                <div className="config-field">
                  <label className="config-label">Log Path</label>
                  <div className="folder-picker-row">
                    <span className="folder-picker-display" title={logDraft.LOG_PATH || 'Not set'}>
                      {logDraft.LOG_PATH || 'Not set'}
                    </span>
                    <button
                      className="auth-btn secondary folder-browse-btn"
                      onClick={handleBrowseFolder}
                      disabled={browsing}
                    >
                      {browsing ? 'Opening…' : 'Browse…'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {!settingsLoading && logError && <div className="config-error">{logError}</div>}
            {logSaved && <div className="config-success">Saved.</div>}
            <div className="config-hint" style={{ marginBottom: 8 }}>Requires server restart to take effect.</div>
            <button
              className="config-save-btn"
              onClick={handleSaveLogging}
              disabled={logSaving || settingsLoading || !logDraft}
            >
              {logSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          </div>
        </>
      )}
    </>
  )
}
