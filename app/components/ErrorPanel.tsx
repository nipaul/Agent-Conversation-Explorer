import type { ConversationEvent } from '../types'

interface Props {
  events: ConversationEvent[]
  allEvents?: ConversationEvent[]
  onNavigate?: (actionId: string) => void
  useUtc?: boolean
}

interface ErrorContext {
  topicName: string | null
  actionId: string | null
}

function resolveContext(ts: string, allEvents: ConversationEvent[]): ErrorContext {
  const sorted = [...allEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  let topicName: string | null = null
  let actionId: string | null = null

  for (const e of sorted) {
    if (e.timestamp > ts) break
    if (e.name === 'TopicStart') {
      topicName = e.customDimensions.TopicName || e.customDimensions.topicName || null
      actionId = null
    } else if (e.name === 'TopicAction') {
      actionId = e.customDimensions.ActionId || null
    }
  }

  return { topicName, actionId }
}

export default function ErrorPanel({ events, allEvents = [], onNavigate, useUtc = false }: Props) {
  if (events.length === 0) {
    return <div className="empty" style={{ padding: 20 }}>No errors in this conversation</div>
  }

  return (
    <div className="error-panel" role="region" aria-label="Errors">
      {events.map((e, i) => {
        const { topicName, actionId } = resolveContext(e.timestamp, allEvents)
        const time = new Date(e.timestamp).toLocaleString([], {
          timeZone: useUtc ? 'UTC' : undefined,
        })

        return (
          <div key={i} className="error-item">
            <div className="error-header">
              <span className="error-icon" aria-hidden="true">⚠</span>
              <span className="error-time">{time}</span>
              {topicName && (
                <span className="error-context-badge topic-badge" title="Topic">{topicName}</span>
              )}
              {actionId && (
                <span className="error-context-badge action-badge" title="Action ID">⬡ {actionId}</span>
              )}
              {actionId && onNavigate && (
                <button
                  className="error-nav-btn"
                  onClick={() => onNavigate(actionId)}
                  title="Jump to this step in the Execution Path"
                >→ Execution Path</button>
              )}
            </div>
            <details open>
              <summary>Error details</summary>
              <pre className="error-dims">
                {JSON.stringify(e.customDimensions, null, 2)}
              </pre>
            </details>
          </div>
        )
      })}
    </div>
  )
}
