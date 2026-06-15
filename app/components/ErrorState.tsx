import { ApiError } from '../api'
import type { ApiErrorCode } from '../types'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  variant?: 'sidebar' | 'detail'
}

// Friendlier, actionable copy for known error codes. Falls back to the raw
// message for anything not listed here.
const CODE_COPY: Partial<Record<ApiErrorCode, string>> = {
  AUTH_REQUIRED: 'Azure session expired. Run `az login` in the server terminal, then retry.',
  NETWORK: "Can't reach the backend. Make sure the server is running, then retry.",
  UPSTREAM_ERROR: "App Insights couldn't be reached. Try again in a moment.",
}

function describe(error: unknown): { code: ApiErrorCode; message: string } {
  if (error instanceof ApiError) {
    const friendly = CODE_COPY[error.code]
    // Keep the server detail alongside the friendly framing for upstream errors.
    const message =
      friendly && error.code === 'UPSTREAM_ERROR' ? `${friendly} (${error.message})` : friendly ?? error.message
    return { code: error.code, message }
  }
  return { code: 'INTERNAL', message: String(error) }
}

export default function ErrorState({ error, onRetry, variant = 'detail' }: ErrorStateProps) {
  const { message } = describe(error)
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
