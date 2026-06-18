import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import logger from './utils/logger'

// Wire application console methods to the app logger so all console output
// is also persisted via the dev server endpoint when running in dev.
;(function patchConsole() {
  // Skip Vite's own HMR/dev-server messages — they are internal infrastructure
  // noise and should not be forwarded to the app server logger.
  function isViteInternal(msg: string) {
    return msg.startsWith('[vite]') || msg.startsWith('[hmr]')
  }

  // Flatten extra console args into a single loggable value.
  // Avoid wrapping a single primitive in an array — that produces the
  // unhelpful "[ [ [Array] ] ]" pattern in server logs.
  function meta(args: any[]): unknown | undefined {
    if (args.length === 0) return undefined
    if (args.length === 1) return args[0]
    return args
  }

  try {
    const origConsole = { ...console }
    console.log = (...args: any[]) => {
      origConsole.log(...args)
      const msg = String(args[0] ?? '')
      try { if (!isViteInternal(msg)) logger.info(msg, meta(args.slice(1))) } catch {}
    }
    console.debug = (...args: any[]) => {
      origConsole.debug(...args)
      const msg = String(args[0] ?? '')
      try { if (!isViteInternal(msg)) logger.debug(msg, meta(args.slice(1))) } catch {}
    }
    console.warn = (...args: any[]) => {
      origConsole.warn(...args)
      const msg = String(args[0] ?? '')
      try { if (!isViteInternal(msg)) logger.warn(msg, meta(args.slice(1))) } catch {}
    }
    console.error = (...args: any[]) => {
      origConsole.error(...args)
      try {
        const first = args[0]
        if (first instanceof Error) {
          logger.error(first, meta(args.slice(1)))
        } else {
          const msg = String(first ?? '')
          if (!isViteInternal(msg)) logger.error(msg, meta(args.slice(1)))
        }
      } catch {}
    }
  } catch {
    // ignore patch failures — app should still run
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
