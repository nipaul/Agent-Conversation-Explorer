import { useEffect, useRef } from 'react'

interface Props {
  phoneFilter: string
  setPhoneFilter: (v: string) => void
  channelFilter: string
  setChannelFilter: (v: string) => void
  agentFilter: Set<string>
  setAgentFilter: (v: Set<string>) => void
  errorsOnly: boolean
  setErrorsOnly: (v: boolean) => void
  includeDesignMode: boolean
  setIncludeDesignMode: (v: boolean) => void
  channels: string[]
  agents: string[]
  anchorEl: HTMLElement | null
  anchorRect: DOMRect
  onClose: () => void
  onClearAll: () => void
}

export default function FilterPopover({
  phoneFilter, setPhoneFilter,
  channelFilter, setChannelFilter,
  agentFilter, setAgentFilter,
  errorsOnly, setErrorsOnly,
  includeDesignMode, setIncludeDesignMode,
  channels, agents,
  anchorEl, anchorRect,
  onClose, onClearAll,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchorEl?.contains(t)) onClose()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [anchorEl, onClose])

  function toggleAgent(name: string) {
    const next = new Set(agentFilter)
    next.has(name) ? next.delete(name) : next.add(name)
    setAgentFilter(next)
  }

  const hasAnyActive = channelFilter !== '' || agentFilter.size > 0 || phoneFilter !== '' || errorsOnly || includeDesignMode

  return (
    <div
      ref={ref}
      className="filter-popover"
      role="dialog"
      aria-label="Filter options"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left, width: 272 }}
    >
      <div className="filter-popover-header">
        <span>Filters</span>
        {hasAnyActive && (
          <button onClick={onClearAll} aria-label="Clear all filters">Clear all</button>
        )}
      </div>

      {channels.length > 0 && (
        <div className="filter-section">
          <div className="filter-section-label">Channel</div>
          <div className="filter-radio-group">
            <label className="filter-radio-item">
              <input type="radio" name="fp-channel" value="" checked={channelFilter === ''} onChange={() => setChannelFilter('')} />
              <span>All channels</span>
            </label>
            {channels.map(ch => (
              <label key={ch} className="filter-radio-item">
                <input type="radio" name="fp-channel" value={ch} checked={channelFilter === ch} onChange={() => setChannelFilter(ch)} />
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
              <button onClick={() => setAgentFilter(new Set())}>Clear</button>
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
        />
      </div>

      <div className="filter-section">
        <label className="filter-toggle-label">
          <input type="checkbox" checked={errorsOnly} onChange={e => setErrorsOnly(e.target.checked)} />
          <span>Errors only</span>
        </label>
      </div>

      <div className="filter-section filter-section-last">
        <label className="filter-toggle-label">
          <input type="checkbox" checked={includeDesignMode} onChange={e => setIncludeDesignMode(e.target.checked)} />
          <span>Include design mode (Studio tests)</span>
        </label>
      </div>
    </div>
  )
}
