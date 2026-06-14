import { useEffect, useRef, useState } from 'react'

export type Theme = 'midnight' | 'ivory'

const THEMES: { id: Theme; label: string; colors: [string, string, string] }[] = [
  { id: 'midnight', label: 'Midnight',      colors: ['#f0f0f0', '#1e1e2e', '#7c3aed'] },
  { id: 'ivory',    label: 'Ivory & Khaki', colors: ['#F2EBD9', '#E0D4BA', '#9E7A00'] },
]

interface Props {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

export default function SettingsMenu({ theme, onThemeChange }: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (!open) return
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        className={`settings-btn${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Settings"
      >
        <span aria-hidden="true">⚙</span>
        <span>Settings</span>
      </button>

      {open && (
        <div ref={panelRef} className="settings-panel" role="dialog" aria-label="Theme settings" style={{ top: pos.top, right: pos.right }}>
          <div className="settings-breadcrumb">
            <span className="settings-icon">⚙</span>
            <span className="breadcrumb-seg">Settings</span>
            <span className="breadcrumb-arrow">›</span>
            <span className="breadcrumb-seg active">Appearance</span>
          </div>

          <div className="settings-body">
            <div className="settings-section-label">Theme</div>
            <div className="theme-grid">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-card${theme === t.id ? ' selected' : ''}`}
                  onClick={() => { onThemeChange(t.id); setOpen(false) }}
                >
                  <div className="theme-swatch">
                    <div className="swatch-sidebar" style={{ background: t.colors[1] }} />
                    <div className="swatch-main" style={{ background: t.colors[0] }}>
                      <div className="swatch-dot" style={{ background: t.colors[2] }} />
                    </div>
                  </div>
                  <div className="theme-card-footer">
                    <span className="theme-card-name">{t.label}</span>
                    {theme === t.id && <span className="theme-card-tick">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
