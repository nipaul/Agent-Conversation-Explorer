import { useEffect, useId, useRef } from 'react'
import type { OutcomeFilterValue } from './ConversationFilters'
import { focusFirstElement, trapTabKey } from './focusUtils'
import { logAction, logUserAction } from '../utils/logger'

interface Props {
  phoneFilter: string
  setPhoneFilter: (v: string) => void
  channelFilter: string
  setChannelFilter: (v: string) => void
  agentFilter: Set<string>
  setAgentFilter: (v: Set<string>) => void
  outcomeFilter: OutcomeFilterValue
  setOutcomeFilter: (v: OutcomeFilterValue) => void
  designMode: 'live' | 'design' | 'all'
  setDesignMode: (v: 'live' | 'design' | 'all') => void
  channels: string[]
  agents: string[]
  anchorRect: DOMRect
  onClose: () => void
  onClearAll: () => void
}

export default function FilterPopover({
  phoneFilter, setPhoneFilter,
  channelFilter, setChannelFilter,
  agentFilter, setAgentFilter,
  outcomeFilter, setOutcomeFilter,
  designMode, setDesignMode,
  channels, agents,
  anchorRect,
  onClose, onClearAll,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => focusFirstElement(ref.current))

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      trapTabKey(e, ref.current)
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target as Node
      if (!ref.current?.contains(target)) {
        focusFirstElement(ref.current)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      requestAnimationFrame(() => {
        const target = restoreFocusRef.current
        if (target && document.contains(target)) target.focus()
      })
    }
  }, [])

  function toggleAgent(name: string) {
    const nowActive = !agentFilter.has(name)
    logAction('FilterPopover', 'filter.agentToggled', { agent: name, nowActive })
    const next = new Set(agentFilter)
    nowActive ? next.add(name) : next.delete(name)
    setAgentFilter(next)
  }

  const hasAnyActive = channelFilter !== '' || agentFilter.size > 0 || phoneFilter !== '' || outcomeFilter !== 'all' || designMode !== 'live'

  return (
    <>
      <div className="filter-popover-backdrop" aria-hidden="true" onMouseDown={onClose} />
      <div
        ref={ref}
        className="filter-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ top: anchorRect.bottom + 4, left: anchorRect.left, width: 272 }}
      >
        <h2 id={titleId} className="sr-only">Filters</h2>
        <div className="filter-popover-header">
          <span>Filters</span>
          <div className="filter-popover-actions">
            {hasAnyActive && (
              <button type="button" onClick={onClearAll} aria-label="Clear all filters">Clear all</button>
            )}
            <button type="button" onClick={onClose} aria-label="Close filters">Close</button>
          </div>
        </div>

        {channels.length > 0 && (
          <div className="filter-section">
            <div className="filter-section-label">Channel</div>
            <div className="filter-radio-group">
              <label className="filter-radio-item">
                <input type="radio" name="fp-channel" value="" checked={channelFilter === ''} onChange={() => { logUserAction('FilterPopover', 'filter.channel', { value: '' }); setChannelFilter('') }} />
                <span>All channels</span>
              </label>
              {channels.map(ch => (
                <label key={ch} className="filter-radio-item">
                  <input type="radio" name="fp-channel" value={ch} checked={channelFilter === ch} onChange={() => { logUserAction('FilterPopover', 'filter.channel', { value: ch }); setChannelFilter(ch) }} />
                  <span>{ch}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {agents.length > 0 && (
          <div className="filter-section">
            <div className="filter-section-label">
              <span>Agent</span>
              {agentFilter.size > 0 && (
                <button type="button" onClick={() => setAgentFilter(new Set())}>Clear</button>
              )}
            </div>
            <div className="filter-checkbox-group">
              {agents.map(a => (
                <label key={a} className="filter-checkbox-item">
                  <input type="checkbox" checked={agentFilter.has(a)} onChange={() => toggleAgent(a)} />
                  <span title={a}>{a}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="filter-section">
          <div className="filter-section-label">Phone</div>
          <input
            className="filter-phone-input"
            type="tel"
            placeholder="+1..."
            aria-label="Phone number filter"
            value={phoneFilter}
            onChange={e => setPhoneFilter(e.target.value)}
            onBlur={e => logAction('FilterPopover', 'filter.phone', { hasValue: !!e.target.value })}
          />
        </div>

        <div className="filter-section">
          <div className="filter-section-title">OUTCOME</div>
          <select
            className="filter-mode-select"
            value={outcomeFilter}
            onChange={e => { logUserAction('FilterPopover', 'filter.outcome', { value: e.target.value }); setOutcomeFilter(e.target.value as OutcomeFilterValue) }}
          >
            <option value="all">All outcomes</option>
            <option value="completed">Completed</option>
            <option value="transferred">Transferred</option>
            <option value="escalated">Escalated</option>
            <option value="errored">Errored</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>

      <div className="filter-section filter-section-last">
        <div className="filter-section-title">MODE</div>
        <select
          className="filter-mode-select"
          value={designMode}
          onChange={e => { logUserAction('FilterPopover', 'filter.designMode', { value: e.target.value }); setDesignMode(e.target.value as 'live' | 'design' | 'all') }}
        >
          <option value="live">Live only</option>
          <option value="design">Design only (Studio tests)</option>
          <option value="all">All conversations</option>
        </select>
      </div>
      </div>
    </>
  )
}
