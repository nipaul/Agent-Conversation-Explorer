import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: (reset: () => void, error: Error) => ReactNode
}

interface State {
  error: Error | null
}

// Catches render-time crashes in the subtree. Async/fetch errors are handled
// separately via ApiError + ErrorState — those never reach here.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.reset, error)
    return (
      <div className="error-state" role="alert">
        <span className="error-state-message">Something went wrong rendering this view.</span>
        <button className="error-retry-btn" onClick={this.reset}>Reload view</button>
        <button className="error-retry-btn" onClick={() => location.reload()}>Reload page</button>
      </div>
    )
  }
}
