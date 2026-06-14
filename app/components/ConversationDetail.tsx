import { useEffect, useRef, useState } from 'react'
import { fetchConversationEvents } from '../api'
import type { ConversationSummary, ConversationEvent } from '../types'
import ChatView, { type ChannelFilter } from './ChatView'
import ExecutionPath from './ExecutionPath'
import ErrorPanel from './ErrorPanel'

interface Props {
  conversation: ConversationSummary
}

type Tab = 'chat' | 'execution' | 'errors'

const CHANNEL_FILTERS: { value: ChannelFilter; label: string; title: string }[] = [
  { value: 'both',  label: 'T+S', title: 'Show text and voice' },
  { value: 'text',  label: 'T',   title: 'Show text only' },
  { value: 'voice', label: 'S',   title: 'Show voice only' },
]

const TABS: Tab[] = ['chat', 'execution', 'errors']

const EXEC_NAMES = new Set(['TopicStart', 'TopicAction', 'TopicEnd'])
const MSG_NAMES  = new Set(['BotMessageSend', 'BotMessageReceived'])

export default function ConversationDetail({ conversation }: Props) {
  const [events, setEvents] = useState<ConversationEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('chat')
  const [refreshKey, setRefreshKey] = useState(0)
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('both')
  const [highlightActionId, setHighlightActionId] = useState<string | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleNavigateToAction(actionId: string) {
    setHighlightActionId(actionId)
    setTab('execution')
  }

  function handleTabKeyDown(e: React.KeyboardEvent, idx: number) {
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    setTab(TABS[next])
    tabRefs.current[next]?.focus()
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    setEvents([])
    fetchConversationEvents(conversation.conversationId)
      .then(setEvents)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [conversation.conversationId, refreshKey])

  const messages   = events.filter(e => MSG_NAMES.has(e.name))
  const execEvents = events.filter(e => EXEC_NAMES.has(e.name))
  const errors     = events.filter(e => e.name === 'OnErrorLog')
  const otherEvents = events.filter(
    e => !EXEC_NAMES.has(e.name) && !MSG_NAMES.has(e.name) && e.name !== 'OnErrorLog'
  )

  const botName = events.find(e => e.cloudRoleInstance)?.cloudRoleInstance ?? null

  const start = new Date(conversation.startTime).toLocaleString()

  return (
    <div className="conv-detail">
      <div className="detail-header">
        <div className="detail-header-top">
          <div className="detail-conv-id">{conversation.conversationId}</div>
          {botName && <span className="detail-bot-name">{botName}</span>}
          <div className="channel-filter" role="group" aria-label="Message channel filter">
            {CHANNEL_FILTERS.map(f => (
              <button
                key={f.value}
                className={`channel-filter-btn${channelFilter === f.value ? ' active' : ''}`}
                onClick={() => setChannelFilter(f.value)}
                title={f.title}
                aria-pressed={channelFilter === f.value}
              >{f.label}</button>
            ))}
          </div>
          <button
            className="detail-refresh-btn"
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={loading}
            title="Refresh conversation events"
            aria-label="Refresh conversation events"
          >⟳</button>
        </div>
        <div className="detail-meta">
          <span className="badge channel">{conversation.channelId}</span>
          <span>{start}</span>
          <span>{conversation.messageCount} user msg{conversation.messageCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Conversation views">
        {TABS.map((id, i) => {
          const isActive = tab === id
          const hasErrors = id === 'errors' && errors.length > 0
          const label = id === 'chat'
            ? `Chat (${messages.length})`
            : id === 'execution'
            ? `Execution Path (${execEvents.length})`
            : `Errors${errors.length > 0 ? ` (${errors.length})` : ''}`
          return (
            <button
              key={id}
              ref={el => { tabRefs.current[i] = el }}
              role="tab"
              id={`tab-${id}`}
              aria-selected={isActive}
              aria-controls={`panel-${id}`}
              tabIndex={isActive ? 0 : -1}
              className={[isActive ? 'active' : '', hasErrors ? 'has-errors' : ''].join(' ')}
              onClick={() => setTab(id)}
              onKeyDown={e => handleTabKeyDown(e, i)}
            >
              {label}
            </button>
          )
        })}
      </div>

      {loading && <div className="loading" role="status" style={{ padding: 20 }}>Loading events…</div>}
      {error && <div className="loading" role="alert" style={{ padding: 20, color: 'var(--error)' }}>{error}</div>}

      {!loading && !error && (
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          className="tab-content"
        >
          {tab === 'chat'      && <ChatView events={messages} allEvents={events} channelFilter={channelFilter} />}
          {tab === 'execution' && <ExecutionPath events={execEvents} otherEvents={otherEvents} highlightActionId={highlightActionId} />}
          {tab === 'errors'    && <ErrorPanel events={errors} allEvents={events} onNavigate={handleNavigateToAction} />}
        </div>
      )}
    </div>
  )
}
