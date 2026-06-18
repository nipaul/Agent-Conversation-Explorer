const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(el => !el.hasAttribute('disabled'))
}

export function focusFirstElement(root: HTMLElement | null): boolean {
  const focusable = getFocusableElements(root)
  if (focusable.length > 0) {
    focusable[0].focus()
    return true
  }
  root?.focus()
  return !!root
}

export function trapTabKey(e: KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== 'Tab') return
  const focusable = getFocusableElements(root)
  if (focusable.length === 0) {
    e.preventDefault()
    root?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement as HTMLElement | null

  if (e.shiftKey) {
    if (!active || active === first || !root?.contains(active)) {
      e.preventDefault()
      last.focus()
    }
    return
  }

  if (!active || active === last || !root?.contains(active)) {
    e.preventDefault()
    first.focus()
  }
}
