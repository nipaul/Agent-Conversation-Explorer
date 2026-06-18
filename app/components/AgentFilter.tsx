import { useEffect, useId, useRef, useState } from 'react'
import { trapTabKey } from './focusUtils'

interface Props {
  agents: string[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
}

export default function AgentFilter({ agents, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const agentsRef = useRef(agents)
  const selectedRef = useRef(selected)
  const activeIndexRef = useRef(0)
  const onChangeRef = useRef(onChange)
  const titleId = useId()
  const listId = useId()

  useEffect(() => {
    agentsRef.current = agents
  }, [agents])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (open) {
      setActiveIndex(i => Math.min(i, Math.max(agents.length - 1, 0)))
    }
  }, [agents, open])

  function close() {
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    restoreFocusRef.current = document.activeElement as HTMLElement | null
    setActiveIndex(current => {
      const currentAgents = agentsRef.current
      const selectedIndex = currentAgents.findIndex(a => selectedRef.current.has(a))
      return selectedIndex >= 0 ? selectedIndex : Math.min(current, Math.max(currentAgents.length - 1, 0))
    })

    requestAnimationFrame(() => listRef.current?.focus())

    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) close()
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target as Node
      if (!btnRef.current?.contains(target) && !listRef.current?.contains(target)) {
        listRef.current?.focus()
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        close()
        return
      }

      const currentAgents = agentsRef.current
      if (currentAgents.length === 0) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        setActiveIndex(i => (i + 1) % currentAgents.length)
        return
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setActiveIndex(i => (i - 1 + currentAgents.length) % currentAgents.length)
        return
      }
      if (e.key === 'Home') {
        e.preventDefault()
        setActiveIndex(0)
        return
      }
      if (e.key === 'End') {
        e.preventDefault()
        setActiveIndex(currentAgents.length - 1)
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        const agent = currentAgents[activeIndexRef.current]
        if (agent) {
          const next = new Set(selectedRef.current)
          next.has(agent) ? next.delete(agent) : next.add(agent)
          onChangeRef.current(next)
        }
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onKeyDown)
      requestAnimationFrame(() => {
        const target = restoreFocusRef.current
        if (target && document.contains(target)) target.focus()
        else btnRef.current?.focus()
      })
    }
  }, [open])

  function toggle(name: string) {
    const next = new Set(selected)
    next.has(name) ? next.delete(name) : next.add(name)
    onChangeRef.current(next)
  }

  const activeCount = selected.size
  const isFiltered = activeCount > 0 && activeCount < agents.length
  const label = isFiltered ? `${activeCount} of ${agents.length} agents` : 'All agents'

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className={`agent-filter-btn ${isFiltered ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
      >
        <span>{label}</span>
        <span className="agent-filter-arrow" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div
          ref={listRef}
          className="agent-dropdown"
          role="listbox"
          aria-labelledby={titleId}
          aria-multiselectable="true"
          aria-activedescendant={agents[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined}
          id={listId}
          tabIndex={0}
          style={{ top: btnRef.current ? btnRef.current.getBoundingClientRect().bottom + 4 : 0, left: btnRef.current ? btnRef.current.getBoundingClientRect().left : 0, minWidth: Math.max(btnRef.current?.getBoundingClientRect().width ?? 0, 220) }}
        >
          <h2 id={titleId} className="sr-only">Filter by agent</h2>
          <div className="agent-dropdown-header">
            <span>Filter by agent</span>
            {selected.size > 0 && (
              <button type="button" className="agent-dropdown-clear" onClick={() => onChange(new Set())}>
                Clear
              </button>
            )}
          </div>
          <div className="agent-dropdown-list">
            {agents.map((a, i) => (
              <div
                key={a}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={selected.has(a)}
                className={`agent-dropdown-item ${selected.has(a) ? 'checked' : ''} ${i === activeIndex ? 'active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => toggle(a)}
              >
                <span className="agent-dropdown-check" aria-hidden="true">
                  {selected.has(a) ? '✓' : ''}
                </span>
                <span className="agent-dropdown-name" title={a}>{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
