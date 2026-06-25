import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchConversations } from '../api'
import type { ConversationSummary } from '../types'
import ConversationFilters, { type OutcomeFilterValue } from './ConversationFilters'
import ErrorState from './ErrorState'
import { logAction, logUserAction, logWarn } from '../utils/logger'

interface Props {
  onSelect: (c: ConversationSummary) => void
  selected: ConversationSummary | null
  onOpenSettings: () => void
  refreshSignal?: number
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ConversationList({ onSelect, selected, onOpenSettings, refreshSignal }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const [search, setSearch]               = useState('')
  const [phoneFilter, setPhoneFilter]     = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [agentFilter, setAgentFilter]     = useState<Set<string>>(new Set())
  const [timeRange, setTimeRange]         = useState('15m')
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterValue>('all')
  const [designMode, setDesignMode] = useState<'live' | 'design' | 'all'>('live')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchConversations(timeRange, designMode)
      .then(data => {
        if (!cancelled) {
          if (data.length === 0) logWarn('ConversationList', 'fetch.empty', { timeRange, designMode })
          setConversations(data)
        }
      })
      .catch(e => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [timeRange, designMode, refreshKey, refreshSignal])

  const channels = useMemo(
    () => [...new Set(conversations.map(c => c.channelId).filter(Boolean))].sort(),
    [conversations]
  )

  const agents = useMemo(
    () => [...new Set(conversations.map(c => c.agentName).filter(Boolean) as string[])].sort(),
    [conversations]
  )

  const filtered = useMemo(() => conversations.filter(c => {
    if (outcomeFilter !== 'all' && c.outcome !== outcomeFilter) return false
    if (channelFilter && c.channelId !== channelFilter) return false
    if (agentFilter.size > 0 && !agentFilter.has(c.agentName ?? '')) return false
    if (phoneFilter) {
      const p = phoneFilter.replace(/\s+/g, '')
      if (!c.callerPhone?.includes(p)) return false
    }
    if (search) {
      const s = search.toLowerCase()
      return c.conversationId.toLowerCase().includes(s) || c.topics.some(t => t.toLowerCase().includes(s))
    }
    return true
  }), [conversations, search, channelFilter, agentFilter, outcomeFilter, phoneFilter])
  useEffect(() => {
    if (!loading && filtered.length === 0 && conversations.length > 0) {
      logWarn('ConversationList', 'filtered.empty', { search, channelFilter, outcomeFilter, hasPhoneFilter: !!phoneFilter, agentFilterCount: agentFilter.size })
    }
  }, [loading, filtered.length, conversations.length, search, channelFilter, outcomeFilter, phoneFilter, agentFilter.size])

  const focusConversationId =
    selected && filtered.some(c => c.conversationId === selected.conversationId)
      ? selected.conversationId
      : filtered[0]?.conversationId

  return (
    <div className="conv-list">
      <ConversationFilters
        search={search}           setSearch={setSearch}
        phoneFilter={phoneFilter} setPhoneFilter={setPhoneFilter}
        channelFilter={channelFilter} setChannelFilter={setChannelFilter}
        agentFilter={agentFilter} setAgentFilter={setAgentFilter}
        timeRange={timeRange}     setTimeRange={setTimeRange}
        outcomeFilter={outcomeFilter} setOutcomeFilter={setOutcomeFilter}
        designMode={designMode} setDesignMode={setDesignMode}
        channels={channels}       agents={agents}
        loading={loading}         onRefresh={() => setRefreshKey(k => k + 1)}
      />

      {loading && <div className="loading" role="status">Loading conversations…</div>}
      {error != null && <ErrorState error={error} variant="sidebar" onRetry={() => setRefreshKey(k => k + 1)} onOpenSettings={onOpenSettings} />}

      {!loading && !error && (
        <div className="conv-items" role="list" aria-label="Conversations">
          {filtered.length === 0 && <div className="empty">No conversations found</div>}
          {filtered.map((c, index) => (
            <button
              key={c.conversationId}
              ref={el => { itemRefs.current[index] = el }}
              type="button"
              aria-current={selected?.conversationId === c.conversationId ? 'true' : undefined}
              tabIndex={focusConversationId === c.conversationId ? 0 : -1}
              className={[
                'conv-item',
                selected?.conversationId === c.conversationId ? 'selected' : '',
                c.hasErrors ? 'has-errors' : '',
              ].join(' ')}
              aria-label={`${c.conversationId}, ${c.messageCount} messages${c.hasErrors ? `, ${c.errorCount} errors` : ''}${c.callerPhone ? `, phone ${c.callerPhone}` : ''}`}
              onClick={() => { logUserAction('ConversationList', 'conversation.selected', { conversationId: c.conversationId, hasErrors: c.hasErrors, channelId: c.channelId }); onSelect(c) }}
              onKeyDown={e => {
                const index = filtered.findIndex(x => x.conversationId === c.conversationId)
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  const nextIndex = (index + 1) % filtered.length
                  const next = filtered[nextIndex]
                  if (next) {
                    logAction('ConversationList', 'keyboard.navigate', { key: e.key, toIndex: nextIndex })
                    onSelect(next)
                    itemRefs.current[nextIndex]?.focus()
                  }
                  return
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  const nextIndex = (index - 1 + filtered.length) % filtered.length
                  const next = filtered[nextIndex]
                  if (next) {
                    logAction('ConversationList', 'keyboard.navigate', { key: e.key, toIndex: nextIndex })
                    onSelect(next)
                    itemRefs.current[nextIndex]?.focus()
                  }
                  return
                }
                if (e.key === 'Home') {
                  e.preventDefault()
                  const next = filtered[0]
                  if (next) {
                    logAction('ConversationList', 'keyboard.navigate', { key: e.key, toIndex: 0 })
                    onSelect(next)
                    itemRefs.current[0]?.focus()
                  }
                  return
                }
                if (e.key === 'End') {
                  e.preventDefault()
                  const nextIndex = filtered.length - 1
                  const next = filtered[nextIndex]
                  if (next) {
                    logAction('ConversationList', 'keyboard.navigate', { key: e.key, toIndex: nextIndex })
                    onSelect(next)
                    itemRefs.current[nextIndex]?.focus()
                  }
                }
              }}
            >
              <div className="conv-item-header">
                <span className="conv-id" title={c.conversationId}>
                  {c.conversationId.length > 22 ? c.conversationId.slice(0, 22) + '…' : c.conversationId}
                </span>
                <span className="conv-time">{relativeTime(c.startTime)}</span>
              </div>
              <div className="conv-item-meta">
                <span className="badge agent" title={c.agentName ?? 'Agent Name unavailable'}>
                  {c.agentName ?? 'unknown agent'}
                </span>
                <span className="badge msgs">{c.messageCount} msgs</span>
                {c.callerPhone && <span className="badge phone">{c.callerPhone}</span>}
                {c.hasErrors && <span className="badge error">⚠ {c.errorCount}</span>}
                <span className={`outcome-text ${c.outcome}`}>{c.outcome}</span>
              </div>
              <div>
                {c.topics.slice(0, 3).map(t => (
                  <span key={t} className="topic-tag">{t}</span>
                ))}
                {c.topics.length > 3 && <span className="topic-tag">+{c.topics.length - 3}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
