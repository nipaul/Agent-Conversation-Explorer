import { useState, useEffect } from 'react'
import type { ConversationEvent } from '../types'
import { logAction } from '../utils/logger'

interface TopicGroup {
  key: string
  topicName: string
  topicId: string
  actions: ConversationEvent[]
  startTs: string
  endTs: string
}

interface Props {
  events: ConversationEvent[]
  otherEvents?: ConversationEvent[]
  highlightActionId?: string | null
  useUtc?: boolean
}

function formatTs(iso: string, useUtc: boolean): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: useUtc ? 'UTC' : undefined,
  })
}

function groupByTopic(events: ConversationEvent[]): TopicGroup[] {
  const groups: TopicGroup[] = []
  let current: TopicGroup | null = null
  let groupIndex = 0

  for (const e of events) {
    const topicName = e.customDimensions.TopicName || e.customDimensions.topicName || ''
    const topicId   = e.customDimensions.TopicId   || e.customDimensions.topicId   || ''

    if (e.name === 'TopicStart') {
      current = { key: `${groupIndex++}`, topicName, topicId, actions: [], startTs: e.timestamp, endTs: e.timestamp }
      groups.push(current)
    } else if (e.name === 'TopicEnd') {
      if (current) current.endTs = e.timestamp
      current = null
    } else if (e.name === 'TopicAction') {
      if (!current) {
        current = { key: `${groupIndex++}`, topicName, topicId, actions: [], startTs: e.timestamp, endTs: e.timestamp }
        groups.push(current)
      }
      current.endTs = e.timestamp
      current.actions.push(e)
    }
  }

  return groups
}

function labelGroups(groups: TopicGroup[]): (TopicGroup & { invLabel: string })[] {
  const counts: Record<string, number> = {}
  const totals: Record<string, number> = {}
  for (const g of groups) totals[g.topicName] = (totals[g.topicName] ?? 0) + 1
  return groups.map(g => {
    counts[g.topicName] = (counts[g.topicName] ?? 0) + 1
    const invLabel = totals[g.topicName] > 1 ? ` (${counts[g.topicName]}/${totals[g.topicName]})` : ''
    return { ...g, invLabel }
  })
}

// Maps each otherEvent to the index of the last action that occurred before it in the group.
function assignToActions(actions: ConversationEvent[], other: ConversationEvent[], group: TopicGroup): Map<number, ConversationEvent[]> {
  const map = new Map<number, ConversationEvent[]>()
  actions.forEach((_, i) => map.set(i, []))

  for (const e of other) {
    if (e.timestamp < group.startTs || e.timestamp > group.endTs) continue
    let idx = 0
    for (let i = 0; i < actions.length; i++) {
      if (actions[i].timestamp <= e.timestamp) idx = i
    }
    map.get(idx)!.push(e)
  }

  return map
}

// Fields that are already shown in the action header or carry no useful context
const BOILERPLATE_KEYS = new Set([
  'Kind', 'ActionId', 'conversationId', 'TopicName', 'TopicId',
  'TopicVersion', 'BotId', 'BotName', 'environmentId', 'channelId', 'sessionId',
  'eventName', // shown as badge in header
])

// Primary fields to surface first, per Kind — all other non-boilerplate fields follow
const KIND_FIELDS: Record<string, string[]> = {
  SetVariable:               ['Variable', 'VariableName', 'Value'],
  Question:                  ['Variable', 'Entity', 'AllowInterruption', 'Prompt'],
  ConditionGroup:            ['Condition', 'Result', 'ConditionResult', 'BranchIndex', 'ElseBranchIndex'],
  SendActivity:              ['ActivityText', 'text', 'speak', 'ActivityId'],
  BeginDialog:               ['Dialog', 'DialogId', 'Inputs', 'Outputs'],
  RecognizeIntent:           ['UserInput', 'IntentName', 'Intent', 'ConfidenceScore'],
  LogCustomTelemetryEvent:   ['EventName', 'Properties', 'properties'],
  SearchAndSummarizeContent: ['UserInput', 'Variable', 'DataSourceId', 'ModerationType'],
  GotoAction:                ['TargetActionId', 'Target'],
  TransferConversationV2:    ['TransferType', 'MessageToAgent'],
  EndDialog:                 [],
}

function ActionContext({ kind, dims }: { kind: string; dims: Record<string, string> }) {
  const primaryKeys = KIND_FIELDS[kind] ?? []
  const primarySet = new Set(primaryKeys)

  const primary = primaryKeys
    .filter(k => k in dims && String(dims[k]).trim() !== '')
    .map(k => ({ key: k, value: dims[k], isPrimary: true }))

  const rest = Object.entries(dims)
    .filter(([k, v]) => !BOILERPLATE_KEYS.has(k) && !primarySet.has(k) && String(v).trim() !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ key: k, value: v, isPrimary: false }))

  const rows = [...primary, ...rest]
  if (rows.length === 0) return null

  return (
    <div className="action-context">
      {rows.map(({ key, value, isPrimary }) => (
        <div key={key} className={`action-ctx-row${isPrimary ? ' primary' : ''}`}>
          <span className="action-ctx-key">{key}</span>
          <span className="action-ctx-val">{value}</span>
        </div>
      ))}
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  return `${m}m ${rem}s`
}

export default function ExecutionPath({ events, otherEvents = [], highlightActionId, useUtc = false }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const groups = labelGroups(groupByTopic(events))

  useEffect(() => {
    if (!highlightActionId) return
    for (const g of groups) {
      if (g.actions.some(a => a.customDimensions.ActionId === highlightActionId)) {
        setExpanded(prev => new Set([...prev, g.key]))
        logAction('ExecutionPath', 'highlightScrolled', { actionId: highlightActionId })
        setTimeout(() => {
          document.getElementById(`action-${highlightActionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 50)
        break
      }
    }
  }, [highlightActionId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (events.length === 0) {
    return <div className="empty" style={{ padding: 20 }}>No execution events recorded</div>
  }

  const withActions = groups.filter(g => g.actions.length > 0)
  const allExpanded = withActions.length > 0 && withActions.every(g => expanded.has(g.key))

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        const g = groups.find(x => x.key === key)
        logAction('ExecutionPath', 'topic.collapsed', { topicName: g?.topicName })
        next.delete(key)
      } else {
        const g = groups.find(x => x.key === key)
        logAction('ExecutionPath', 'topic.expanded', { topicName: g?.topicName, actionCount: g?.actions.length })
        next.add(key)
      }
      return next
    })
  }

  function expandAll()  { logAction('ExecutionPath', 'expandAll', { topicCount: withActions.length }); setExpanded(new Set(withActions.map(g => g.key))) }
  function collapseAll() { logAction('ExecutionPath', 'collapseAll'); setExpanded(new Set()) }

  return (
    <div className="exec-path">
      {withActions.length > 0 && (
          <div className="exec-path-toolbar">
          <button type="button" className="exec-toolbar-btn" onClick={allExpanded ? collapseAll : expandAll}>
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}

      {groups.map((g, i) => {
        const assignMap = assignToActions(g.actions, otherEvents, g)

        return (
          <div key={g.key} className={`topic-group ${g.actions.length === 0 ? 'interrupted' : ''}`}>
            {g.actions.length === 0 ? (
              <div className="topic-node interrupted" aria-disabled="true">
                <span className="topic-arrow" aria-hidden="true">→</span>
                <span className="topic-name">
                  {g.topicName || g.topicId || '(unknown topic)'}
                  {g.invLabel && <span className="inv-label">{g.invLabel}</span>}
                </span>
                <span className="action-count interrupted-badge">interrupted</span>
              </div>
            ) : (
              <button
                type="button"
                className="topic-node"
                aria-expanded={expanded.has(g.key)}
                aria-controls={`topic-actions-${g.key}`}
                aria-label={`${expanded.has(g.key) ? 'Collapse' : 'Expand'} topic ${g.topicName || g.topicId || '(unknown topic)'} with ${g.actions.length} actions`}
                onClick={() => toggle(g.key)}
              >
                <span className="topic-arrow" aria-hidden="true">{expanded.has(g.key) ? '▼' : '▶'}</span>
                <span className="topic-name">
                  {g.topicName || g.topicId || '(unknown topic)'}
                  {g.invLabel && <span className="inv-label">{g.invLabel}</span>}
                </span>
                <span className="action-count">{g.actions.length} {g.actions.length === 1 ? 'action' : 'actions'} · <span className="topic-duration">{formatDuration(new Date(g.endTs).getTime() - new Date(g.startTs).getTime())}</span></span>
              </button>
            )}

            {expanded.has(g.key) && g.actions.length > 0 && (
              <div className="action-list" id={`topic-actions-${g.key}`}>
                {g.actions.map((a, j) => {
                  const related = assignMap.get(j) ?? []
                  const rawDetails = related.length > 0
                    ? {
                        ...a.customDimensions,
                        _events: related.map(e => ({ name: e.name, ...e.customDimensions })),
                      }
                    : a.customDimensions

                  const isHighlighted = a.customDimensions.ActionId === highlightActionId

                  return (
                    <div
                      key={j}
                      id={a.customDimensions.ActionId ? `action-${a.customDimensions.ActionId}` : undefined}
                      className={`action-node${isHighlighted ? ' highlighted' : ''}`}
                    >
                      <div className="action-node-header">
                        <span className="action-kind">{a.customDimensions.Kind || 'Action'}</span>
                        <span className="action-id">{a.customDimensions.ActionId || '—'}</span>
                        {a.customDimensions.eventName && (
                          <span className="action-event-name">{a.customDimensions.eventName}</span>
                        )}
                        <span className="action-ts">
                          {formatTs(a.timestamp, useUtc)}
                          {(() => {
                            const nextTs = g.actions[j + 1]?.timestamp ?? g.endTs
                            const ms = new Date(nextTs).getTime() - new Date(a.timestamp).getTime()
                            return ms > 0 ? <span className="action-duration"> · {formatDuration(ms)}</span> : null
                          })()}
                        </span>
                      </div>
                      <details className="action-dims">
                        <summary>details{related.length > 0 ? ` +${related.length} events` : ''}</summary>
                        <ActionContext kind={a.customDimensions.Kind || ''} dims={a.customDimensions} />
                        {related.length > 0 && (
                          <div className="action-related-events">
                            <div className="action-related-label">Related events</div>
                            {related.map((ev, k) => {
                              const evDims = Object.entries(ev.customDimensions)
                                .filter(([key]) => !BOILERPLATE_KEYS.has(key))
                              return (
                                <div key={k} className="related-event-row">
                                  <span className="related-event-name">{ev.name}</span>
                                  {evDims.slice(0, 4).map(([key, val]) => (
                                    <span key={key} className="related-event-kv">
                                      <span className="related-event-k">{key}:</span>
                                      <span className="related-event-v">{String(val).slice(0, 80)}</span>
                                    </span>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        <details className="action-raw-json">
                          <summary>raw JSON</summary>
                          <pre>{JSON.stringify(rawDetails, null, 2)}</pre>
                        </details>
                      </details>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
