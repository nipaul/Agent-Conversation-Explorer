import { useEffect, useRef, useState } from 'react'

interface Props {
  agents: string[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
}

export default function AgentFilter({ agents, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (!open) return
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !dropRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function toggle(name: string) {
    const next = new Set(selected)
    next.has(name) ? next.delete(name) : next.add(name)
    onChange(next)
  }

  const activeCount = selected.size
  const isFiltered = activeCount > 0 && activeCount < agents.length
  const label = isFiltered ? `${activeCount} of ${agents.length} agents` : 'All agents'

  return (
    <>
      <button
        ref={btnRef}
        className={`agent-filter-btn ${isFiltered ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span>{label}</span>
        <span className="agent-filter-arrow">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div
          ref={dropRef}
          className="agent-dropdown"
          style={{ top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 220) }}
        >
          <div className="agent-dropdown-header">
            <span>Filter by agent</span>
            {selected.size > 0 && (
              <button className="agent-dropdown-clear" onClick={() => onChange(new Set())}>
                Clear
              </button>
            )}
          </div>
          <div className="agent-dropdown-list">
            {agents.map(a => (
              <label key={a} className={`agent-dropdown-item ${selected.has(a) ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.has(a)}
                  onChange={() => toggle(a)}
                />
                <span className="agent-dropdown-name" title={a}>{a}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
