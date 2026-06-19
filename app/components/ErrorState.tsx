import { ApiError } from '../api'
import type { ApiErrorCode } from '../types'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  onOpenSettings?: () => void
  variant?: 'sidebar' | 'detail'
}

const CODE_COPY: Partial<Record<ApiErrorCode, string>> = {
  NETWORK: "Can't reach the backend. Make sure the server is running, then retry.",
  UPSTREAM_ERROR: "App Insights couldn't be reached. Try again in a moment.",
}

function describe(error: unknown): { code: ApiErrorCode; message: string } {
  if (error instanceof ApiError) {
    const friendly = CODE_COPY[error.code]
    const message =
      friendly && error.code === 'UPSTREAM_ERROR' ? `${friendly} (${error.message})` : friendly ?? error.message
    return { code: error.code, message }
  }
  return { code: 'INTERNAL', message: String(error) }
}

export default function ErrorState({ error, onRetry, onOpenSettings, variant = 'detail' }: ErrorStateProps) {
  const { code, message } = describe(error)

  if (code === 'AUTH_REQUIRED') {
    return (
      <div className={`error-state${variant === 'sidebar' ? ' sidebar' : ''}`} role="alert">
        <span className="error-state-icon">🔐</span>
        <span className="error-state-message">Not signed in to Azure.</span>
        <span className="error-state-sub">Open Settings to sign in and verify your connection string.</span>
        {onOpenSettings && (
          <button className="error-open-settings-btn" onClick={onOpenSettings}>
            Open Settings
          </button>
        )}
        {onRetry && (
          <button className="error-retry-btn" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`error-state${variant === 'sidebar' ? ' sidebar' : ''}`} role="alert">
      <span className="error-state-message">{message}</span>
      {onRetry && (
        <button className="error-retry-btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
