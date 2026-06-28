import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ConversationEvent } from '../types'
import { logAction } from '../utils/logger'

// Why a topic group recorded zero actions:
//   overridden  — a new TopicStart fired before this topic ran any actions (redirect / escalation)
//   empty       — TopicEnd fired immediately with no actions (topic ran but emitted nothing)
//   incomplete  — conversation ended before TopicEnd arrived (telemetry cutoff or crash)
//   tool        — Copilot Studio tool / connector invocation; these never emit TopicAction events
type InterruptReason = 'overridden' | 'empty' | 'incomplete' | 'tool'

interface TopicGroup {
  key: string
  topicName: string
  topicId: string
  actions: ConversationEvent[]
  startTs: string
  endTs: string
  interruptReason?: InterruptReason
}

interface Props {
  events: ConversationEvent[]
  otherEvents?: ConversationEvent[]
  highlightActionId?: string | null
  useUtc?: boolean
  showActivityDetails?: boolean
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
      // If a prior topic had no actions before this new TopicStart, it was overridden
      if (current && current.actions.length === 0) {
        current.interruptReason = 'overridden'
      }
      current = { key: `${groupIndex++}`, topicName, topicId, actions: [], startTs: e.timestamp, endTs: e.timestamp }
      groups.push(current)
    } else if (e.name === 'TopicEnd') {
      if (current) {
        current.endTs = e.timestamp
        // TopicEnd arrived but no actions were recorded — topic ran but emitted nothing
        if (current.actions.length === 0 && !current.interruptReason) {
          current.interruptReason = 'empty'
        }
      }
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

  // Any group still open at end-of-stream with no actions never received TopicEnd
  if (current && current.actions.length === 0 && !current.interruptReason) {
    current.interruptReason = 'incomplete'
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
    if (actions.length === 0) continue
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
  'DesignMode', 'designMode',
  // dependency fields — rendered separately, not as generic ActionContext rows
  '_table', '_target', '_type', '_duration', '_success', '_resultCode', '_data',
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
  // Tool call action kinds
  InvokeActionV2:            ['ActionName', 'Inputs', 'Outputs', 'Status', 'ErrorMessage'],
  CallAction:                ['ActionName', 'Inputs', 'Result'],
  PluginAction:              ['PluginName', 'FunctionName', 'Inputs', 'Outputs'],
  HTTPRequest:               ['Url', 'Method', 'StatusCode', 'Response'],
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

function InfoTooltip({ text, label, anchor = 'right' }: { text: string; label: string; anchor?: 'left' | 'right' }) {
  const [visible, setVisible] = useState(false)
  const btnRef = useRef<HTMLSpanElement>(null)
  const [tipStyle, setTipStyle] = useState<React.CSSProperties>({})

  function calcPos() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setTipStyle({
      top: r.bottom + 8,
      ...(anchor === 'right'
        ? { right: window.innerWidth - r.right }
        : { left: r.left }),
    })
  }

  return (
    <span
      className="info-tooltip-wrap"
      onMouseEnter={() => { calcPos(); setVisible(true) }}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => { calcPos(); setVisible(true) }}
      onBlur={() => setVisible(false)}
    >
      <span
        ref={btnRef}
        role="img"
        aria-label={label}
        className="info-tooltip-btn"
        tabIndex={0}
        onClick={e => e.stopPropagation()}
      >i</span>
      {visible && createPortal(
        <span className="info-tooltip-body info-tooltip-portal" role="tooltip" style={tipStyle}>{text}</span>,
        document.body
      )}
    </span>
  )
}

const INTERRUPT_INFO: Record<InterruptReason, { label: string; tooltip: string }> = {
  overridden:  {
    label:   'interrupted · overridden',
    tooltip: 'A new TopicStart event fired before this topic executed any actions. '
           + 'This typically means the conversation was redirected to another topic '
           + '(e.g. an escalation, a system redirect, or a GoTo action in the previous topic) '
           + 'before this topic had a chance to run.',
  },
  empty:       {
    label:   'interrupted · no actions',
    tooltip: 'A TopicEnd event arrived immediately after TopicStart with no TopicAction events in between. '
           + 'The topic was invoked and exited cleanly but emitted no action telemetry. '
           + 'This can happen for pass-through topics or topics with only variable assignments '
           + 'that Copilot Studio does not instrument.',
  },
  incomplete:  {
    label:   'interrupted · incomplete',
    tooltip: 'A TopicStart event was recorded but no TopicEnd or TopicAction events followed. '
           + 'The telemetry stream ended before the topic completed — this usually indicates '
           + 'the conversation was dropped, the bot crashed, or telemetry was cut off mid-execution.',
  },
  tool:        {
    label:   'interrupted · tool call',
    tooltip: 'This topic was invoked as a tool or connector call by the Copilot Studio orchestrator. '
           + 'Tool invocations emit a TopicStart but do not produce TopicAction events — '
           + 'the actual work is tracked as a dependency call (shown below). '
           + 'Expand this row to see the dependency details.',
  },
}

function InterruptedBadge({ reason }: { reason: InterruptReason | undefined }) {
  const info = reason ? INTERRUPT_INFO[reason] : null
  const tooltipText = info ? info.tooltip : 'This topic started but recorded no actions.'
  return (
    <span className="action-count interrupted-badge">
      {info ? info.label : 'interrupted'}
      <InfoTooltip
        text={tooltipText}
        label={`Interrupted topic info: ${tooltipText}`}

      />
    </span>
  )
}

function DepEventCard({ ev }: { ev: ConversationEvent }) {
  const ms = parseInt(ev.customDimensions._duration ?? '0', 10)
  const durationLabel = isNaN(ms) ? '' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  const succeeded = String(ev.customDimensions._success).toLowerCase() === 'true'
  const afterPrefix = ev.name.slice('_dep:'.length)
  const typeEnd = afterPrefix.indexOf(':')
  const depType = typeEnd >= 0 ? afterPrefix.slice(0, typeEnd) : (ev.customDimensions._type || '')
  const depName = typeEnd >= 0 ? afterPrefix.slice(typeEnd + 1) : ''
  const depLabel = depType && depName ? `${depType}: ${depName}` : depType || depName || ev.customDimensions._target || ev.name

  return (
    <div className={`related-event-row dep-event${succeeded ? '' : ' dep-failed'}`}>
      <span className="related-event-name dep-icon">⚙</span>
      <span className="related-event-kv dep-label">{depLabel}</span>
      {durationLabel && (
        <span className="related-event-kv">
          <span className="related-event-k">duration:</span>
          <span className="related-event-v">{durationLabel}</span>
        </span>
      )}
      {ev.customDimensions._resultCode && (
        <span className={`related-event-kv dep-status${succeeded ? '' : ' dep-status-fail'}`}>
          <span className="related-event-k">status:</span>
          <span className="related-event-v">{ev.customDimensions._resultCode}</span>
        </span>
      )}
      {ev.customDimensions._data && (
        <span className="related-event-kv dep-data">
          <span className="related-event-k">data:</span>
          <span className="related-event-v">{String(ev.customDimensions._data).slice(0, 120)}</span>
        </span>
      )}
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

export default function ExecutionPath({ events, otherEvents = [], highlightActionId, useUtc = false, showActivityDetails = false }: Props) {
  const visibleOtherEvents = showActivityDetails ? otherEvents : otherEvents.filter(e => e.name !== 'BotMessageSend')
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

  const hasDepsInPath     = visibleOtherEvents.some(e => e.name.startsWith('_dep:'))
  const hasActivityInPath = showActivityDetails && visibleOtherEvents.some(e => e.name === 'BotMessageSend')

  return (
    <div className="exec-path">
      {withActions.length > 0 && (
        <div className="exec-path-toolbar">
          <div className="exec-path-legend" role="list" aria-label="Legend">
            {hasDepsInPath && (
              <span className="legend-item" role="listitem">
                <span className="dep-dot" aria-hidden="true" />
                Dependency call
                <InfoTooltip
                  text="An outbound call made during this topic or action — such as a connector invocation, HTTP request, or Power Automate flow. Topics and actions with a green border contain dependency calls; expand the details section to see the call target, duration, and status code."
                  label="Dependency call: An outbound call such as a connector invocation, HTTP request, or Power Automate flow."
                  anchor="left"
                />
              </span>
            )}
            {hasActivityInPath && (
              <span className="legend-item" role="listitem">
                <span className="activity-dot" aria-hidden="true" />
                Channel activity
                <InfoTooltip
                  text="A channel activity event — such as a handoff initiation or end-of-conversation signal — was sent during this topic or action."
                  label="Channel activity: A channel activity event such as a handoff or end-of-conversation signal."
                  anchor="left"
                />
              </span>
            )}
          </div>
          <button type="button" className="exec-toolbar-btn" onClick={allExpanded ? collapseAll : expandAll}>
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}

      {groups.map((g, i) => {
        const assignMap = assignToActions(g.actions, visibleOtherEvents, g)
        const topicHasActivity = showActivityDetails && g.actions.some((_, j) =>
          (assignMap.get(j) ?? []).some(e => e.name === 'BotMessageSend')
        )
        const topicHasDeps = g.actions.some((_, j) =>
          (assignMap.get(j) ?? []).some(e => e.name.startsWith('_dep:'))
        )
        // Deps that landed in an interrupted topic (no TopicAction events to attach to)
        const interruptedDeps = g.actions.length === 0
          ? visibleOtherEvents.filter(e =>
              e.name.startsWith('_dep:') &&
              e.timestamp >= g.startTs && e.timestamp <= g.endTs
            )
          : []
        // Refine the interrupt reason when dep calls are present — it's a tool/connector invocation
        const interruptReason: InterruptReason | undefined =
          g.actions.length === 0 && interruptedDeps.length > 0 ? 'tool' : g.interruptReason

        return (
          <div key={g.key} className={`topic-group${g.actions.length === 0 ? ` interrupted${interruptReason === 'tool' ? ' tool-call' : ''}` : (topicHasDeps ? ' has-deps' : '')}`}>
            {g.actions.length === 0 ? (
              interruptedDeps.length > 0 ? (
                <>
                  <button
                    type="button"
                    className="topic-node interrupted"
                    aria-expanded={expanded.has(g.key)}
                    aria-controls={`topic-actions-${g.key}`}
                    onClick={() => toggle(g.key)}
                  >
                    <span className="topic-arrow" aria-hidden="true">{expanded.has(g.key) ? '▼' : '▶'}</span>
                    <span className="topic-name">
                      {g.topicName || g.topicId || '(unknown topic)'}
                      {g.invLabel && <span className="inv-label">{g.invLabel}</span>}
                    </span>
                    <span className="dep-dot" title="Contains dependency calls" />
                    <InterruptedBadge reason={interruptReason} />
                  </button>
                  {expanded.has(g.key) && (
                    <div className="action-list interrupted-deps" id={`topic-actions-${g.key}`}>
                      {interruptedDeps.map((ev, k) => <DepEventCard key={k} ev={ev} />)}
                    </div>
                  )}
                </>
              ) : (
                <div className="topic-node interrupted" aria-disabled="true">
                  <span className="topic-arrow" aria-hidden="true">→</span>
                  <span className="topic-name">
                    {g.topicName || g.topicId || '(unknown topic)'}
                    {g.invLabel && <span className="inv-label">{g.invLabel}</span>}
                  </span>
                  <InterruptedBadge reason={interruptReason} />
                </div>
              )
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
                {topicHasActivity && <span className="activity-dot" title="Contains channel activity events" />}
                {topicHasDeps && <span className="dep-dot" title="Contains dependency calls" />}
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
                  const actionHasActivity = showActivityDetails && related.some(e => e.name === 'BotMessageSend')
                  const actionHasDeps = related.some(e => e.name.startsWith('_dep:'))

                  return (
                    <div
                      key={j}
                      id={a.customDimensions.ActionId ? `action-${a.customDimensions.ActionId}` : undefined}
                      className={`action-node${isHighlighted ? ' highlighted' : ''}${actionHasDeps ? ' has-deps' : ''}`}
                    >
                      <div className="action-node-header">
                        <span className="action-kind">{a.customDimensions.Kind || 'Action'}</span>
                        {actionHasActivity && <span className="activity-dot" title="Has channel activity events" />}
                        {actionHasDeps && <span className="dep-dot" title="Has dependency calls" />}
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
                              const isBotActivity = ev.name === 'BotMessageSend'
                              const isDependency  = ev.name.startsWith('_dep:')
                              const isCustomTelemetry = !isBotActivity && !isDependency

                              if (isDependency) {
                                return <DepEventCard key={k} ev={ev} />
                              }

                              if (isCustomTelemetry) {
                                const CUSTOM_SKIP = new Set([...BOILERPLATE_KEYS])
                                const evDims = Object.entries(ev.customDimensions)
                                  .filter(([key]) => !CUSTOM_SKIP.has(key) && String(ev.customDimensions[key]).trim() !== '')
                                return (
                                  <div key={k} className="related-event-row custom-telemetry">
                                    <span className="related-event-name custom-telemetry-name">{ev.name}</span>
                                    {evDims.map(([key, val]) => (
                                      <span key={key} className="related-event-kv">
                                        <span className="related-event-k">{key}:</span>
                                        <span className="related-event-v">{String(val).slice(0, 200)}</span>
                                      </span>
                                    ))}
                                  </div>
                                )
                              }

                              // BotMessageSend (bot activity)
                              const ACTIVITY_SKIP = new Set(['type', 'name', ...BOILERPLATE_KEYS])
                              const evDims = Object.entries(ev.customDimensions)
                                .filter(([key]) => !ACTIVITY_SKIP.has(key))
                              const actLabel = [ev.customDimensions.type?.trim(), ev.customDimensions.name?.trim()].filter(Boolean).join(' · ') || 'activity'
                              return (
                                <div key={k} className="related-event-row bot-activity">
                                  <span className="related-event-name">{actLabel}</span>
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
                        <div className="action-raw-json">
                          <div className="action-raw-json-label">Raw JSON</div>
                          <pre>{JSON.stringify(rawDetails, null, 2)}</pre>
                        </div>
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
