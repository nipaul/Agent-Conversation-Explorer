import type { ConversationEvent } from '../types'

export type ChannelFilter = 'both' | 'text' | 'voice'

interface Props {
  events: ConversationEvent[]
  allEvents: ConversationEvent[]
  channelFilter?: ChannelFilter
  useUtc?: boolean
  showActivityDetails?: boolean
}

function resolveActionId(ts: string, sendActions: ConversationEvent[]): string {
  let best: ConversationEvent | null = null
  for (const a of sendActions) {
    if (a.timestamp <= ts) best = a
    else break
  }
  return best?.customDimensions.ActionId || 'n/a'
}

export default function ChatView({ events, allEvents, channelFilter = 'both', useUtc = false, showActivityDetails = false }: Props) {
  const generatedActivityIds = new Set(
    allEvents
      .filter(e => e.name === 'GenerativeAnswers')
      .map(e => e.customDimensions.activityId)
      .filter(Boolean)
  )

  // TopicAction events where Kind=SendActivity, sorted ascending — correlates with BotMessageSend
  const sendActivityActions = allEvents
    .filter(e => e.name === 'TopicAction' && e.customDimensions.Kind === 'SendActivity')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  if (events.length === 0) {
    return <div className="empty" style={{ padding: 20 }}>No messages in this conversation</div>
  }

  const showText  = channelFilter !== 'voice'
  const showSpeak = channelFilter !== 'text'

  return (
    <div className="chat-view" role="log" aria-label="Conversation messages" aria-live="polite">
      {events.map((e, i) => {
        const isBot        = e.name === 'BotMessageSend'
        const textContent  = e.customDimensions.text?.replace(/<[^>]+>/g, '').trim() || ''
        const speakContent = e.customDimensions.speak?.replace(/<[^>]+>/g, '').trim() || ''
        const isGenerated  = isBot && generatedActivityIds.has(e.customDimensions.activityId)
        const actionId     = isBot ? resolveActionId(e.timestamp, sendActivityActions) : null
        const hasText      = isBot && Boolean(textContent)
        const hasSpeak     = isBot && Boolean(speakContent)
        const userText     = !isBot ? (textContent || speakContent || '(no text)') : ''
        const time = new Date(e.timestamp).toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          timeZone: useUtc ? 'UTC' : undefined,
        })

        if (isBot && !hasText && !hasSpeak && !showActivityDetails) return null

        if (isBot && !hasText && !hasSpeak) {
          const actType = e.customDimensions.type?.trim() || ''
          const actName = e.customDimensions.name?.trim() || ''
          const SKIP = new Set([
            'type', 'name', 'text', 'speak', 'activityId',
            'conversationId', 'channelId', 'sessionId',
            'BotId', 'BotName', 'environmentId', 'DesignMode', 'designMode',
            'Kind', 'ActionId', 'TopicName', 'TopicId', 'TopicVersion',
          ])
          const extras = Object.entries(e.customDimensions)
            .filter(([k, v]) => !SKIP.has(k) && String(v).trim() !== '')
            .slice(0, 4)
          const label = [actType || 'activity', actName].filter(Boolean).join(' · ')
          return (
            <div key={i} className="system-event-row">
              <span className="system-event-line" />
              <div className="system-event-content">
                <span className="system-event-label">{label}</span>
                {showActivityDetails && extras.length > 0 && (
                  <div className="system-event-extras">
                    {extras.map(([k, v]) => (
                      <div key={k} className="system-event-kv">
                        <span className="system-event-k">{k}</span>
                        <span className="system-event-v">{String(v).slice(0, 120)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <span className="system-event-meta">
                  {time}{actionId && <> · <span className="system-event-action-id">⬡ {actionId}</span></>}
                </span>
              </div>
              <span className="system-event-line" />
            </div>
          )
        }

        return (
          <div key={i} className={`bubble-row ${isBot ? 'bot' : 'user'}`}>
            <div className={`bubble ${isBot ? 'bot' : 'user'}`}>
              {isBot ? (
                <>
                  {showText && hasText && (
                    <div className="bubble-channel-row">
                      <span className="channel-label text-label">T</span>
                      <span className="bubble-channel-text">{textContent}</span>
                    </div>
                  )}
                  {showSpeak && hasSpeak && (
                    <div className="bubble-channel-row">
                      <span className="channel-label speak-label">S</span>
                      <span className="bubble-channel-text">{speakContent}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="bubble-text">{userText}</div>
              )}
              <div className="bubble-meta">
                {time}
                {isGenerated && <span className="ai-badge">AI</span>}
                {hasText  && <span className="msg-type-badge text-badge"  title="Text channel">T</span>}
                {hasSpeak && <span className="msg-type-badge speak-badge" title="Speech channel">S</span>}
                {actionId && <span className="bubble-action-id" title="Action ID">⬡ {actionId}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
