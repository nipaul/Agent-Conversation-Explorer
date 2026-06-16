import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import logger from './utils/logger'

// Wire application console methods to the app logger so all console output
// is also persisted via the dev server endpoint when running in dev.
;(function patchConsole() {
  try {
    const origConsole = { ...console }
    console.log = (...args: any[]) => {
      origConsole.log(...args)
      try { logger.info(String(args[0] ?? ''), args.slice(1)) } catch {}
    }
    console.debug = (...args: any[]) => {
      origConsole.debug(...args)
      try { logger.debug(String(args[0] ?? ''), args.slice(1)) } catch {}
    }
    console.warn = (...args: any[]) => {
      origConsole.warn(...args)
      try { logger.warn(String(args[0] ?? ''), args.slice(1)) } catch {}
    }
    console.error = (...args: any[]) => {
      origConsole.error(...args)
      try {
        const first = args[0]
        if (first instanceof Error) logger.error(first, { rest: args.slice(1) })
        else logger.error(String(first ?? ''), args.slice(1))
      } catch {}
    }
  } catch (e) {
    // ignore patch failures — app should still run
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
