import { useRef, useState } from 'react'
import FilterPopover from './FilterPopover'

interface Props {
  search: string
  setSearch: (v: string) => void
  phoneFilter: string
  setPhoneFilter: (v: string) => void
  channelFilter: string
  setChannelFilter: (v: string) => void
  agentFilter: Set<string>
  setAgentFilter: (v: Set<string>) => void
  timeRange: string
  setTimeRange: (v: string) => void
  errorsOnly: boolean
  setErrorsOnly: (v: boolean) => void
  includeDesignMode: boolean
  setIncludeDesignMode: (v: boolean) => void
  channels: string[]
  agents: string[]
  loading: boolean
  onRefresh: () => void
}

const TIME_OPTIONS = [
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '1d', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

export default function ConversationFilters({
  search, setSearch,
  phoneFilter, setPhoneFilter,
  channelFilter, setChannelFilter,
  agentFilter, setAgentFilter,
  timeRange, setTimeRange,
  errorsOnly, setErrorsOnly,
  includeDesignMode, setIncludeDesignMode,
  channels, agents,
  loading, onRefresh,
}: Props) {
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const activeCount = [
    channelFilter !== '',
    agentFilter.size > 0,
    phoneFilter !== '',
    errorsOnly,
    includeDesignMode,
  ].filter(Boolean).length

  function togglePopover() {
    if (!open && btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }

  function clearAll() {
    setChannelFilter('')
    setAgentFilter(new Set())
    setPhoneFilter('')
    setErrorsOnly(false)
    setIncludeDesignMode(false)
  }

  const chips: { key: string; label: string; clear: () => void }[] = []
  if (channelFilter) chips.push({ key: 'channel', label: channelFilter, clear: () => setChannelFilter('') })
  if (agentFilter.size > 0) chips.push({ key: 'agent', label: agentFilter.size === 1 ? [...agentFilter][0] : `${agentFilter.size} agents`, clear: () => setAgentFilter(new Set()) })
  if (phoneFilter) chips.push({ key: 'phone', label: phoneFilter, clear: () => setPhoneFilter('') })
  if (errorsOnly) chips.push({ key: 'errors', label: 'Errors only', clear: () => setErrorsOnly(false) })
  if (includeDesignMode) chips.push({ key: 'design', label: 'Design mode', clear: () => setIncludeDesignMode(false) })

  return (
    <div className="conv-filters">
      <div className="filter-top-row">
        <input
          className="search-input"
          type="text"
          placeholder="Search conversations..."
          aria-label="Search conversations"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="reload-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh conversations"
          aria-label="Refresh conversations"
        >
          {loading ? '…' : '↻'}
        </button>
        <button
          type="button"
          ref={btnRef}
          className={`filter-toggle-btn ${activeCount > 0 ? 'active' : ''}`}
          onClick={togglePopover}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
        >
          <span>Filters</span>
          {activeCount > 0 && <span className="filter-count-badge" aria-hidden="true">{activeCount}</span>}
        </button>
      </div>

      <div className="time-range-group" role="group" aria-label="Time range">
        {TIME_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`time-range-btn ${timeRange === opt.value ? 'active' : ''}`}
            onClick={() => setTimeRange(opt.value)}
            aria-pressed={timeRange === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {chips.length > 0 && (
        <div className="active-chips">
          {chips.map(chip => (
            <span key={chip.key} className="active-chip">
              {chip.label}
              <button
                type="button"
                className="chip-dismiss"
                onClick={chip.clear}
                aria-label={`Remove ${chip.label} filter`}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {open && anchorRect && (
        <FilterPopover
          phoneFilter={phoneFilter} setPhoneFilter={setPhoneFilter}
          channelFilter={channelFilter} setChannelFilter={setChannelFilter}
          agentFilter={agentFilter} setAgentFilter={setAgentFilter}
          errorsOnly={errorsOnly} setErrorsOnly={setErrorsOnly}
          includeDesignMode={includeDesignMode} setIncludeDesignMode={setIncludeDesignMode}
          channels={channels} agents={agents}
          anchorRect={anchorRect}
          onClose={() => setOpen(false)}
          onClearAll={() => { clearAll(); setOpen(false) }}
        />
      )}
    </div>
  )
}
