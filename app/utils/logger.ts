type Level = 'debug' | 'info' | 'warn' | 'error'

const SERVER_LOG_ENDPOINT = '/api/local-log'
const SEND_TO_SERVER = import.meta.env.MODE !== 'production'

// Capture original console methods at module init time, before main.tsx patches them.
// Without this, logger.debug() → console.debug() (patched) → logger.debug() → infinite loop.
const _console = {
  debug: console.debug.bind(console),
  log:   console.log.bind(console),
  warn:  console.warn.bind(console),
  error: console.error.bind(console),
}

const LEVEL_PRIORITY: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 }

// Defaults to 'debug' so all levels show in dev. Call setClientLogLevel() on startup
// to honor the server LOG_LEVEL and avoid unnecessary network posts.
let _clientLevel = 'debug'

export function setClientLogLevel(level: string) {
  if (level in LEVEL_PRIORITY) _clientLevel = level
}

function clientShouldLog(level: string): boolean {
  return (LEVEL_PRIORITY[level] ?? 0) >= (LEVEL_PRIORITY[_clientLevel] ?? 0)
}

function maskObject(obj: any): any {
  if (obj == null) return obj
  if (Array.isArray(obj)) return obj.map(maskObject)
  if (typeof obj !== 'object') return obj
  const SENSITIVE = ['password', 'pwd', 'token', 'accessToken', 'authorization', 'phone', 'phoneNumber', 'ssn']
  const out: any = {}
  for (const k of Object.keys(obj)) {
    if (SENSITIVE.includes(k)) out[k] = '***'
    else out[k] = maskObject(obj[k])
  }
  return out
}

async function send(level: Level, message: string, meta?: unknown) {
  if (!SEND_TO_SERVER) return
  try {
    await fetch(SERVER_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, meta: maskObject(meta) }),
    })
  } catch {
    // ignore network/logging failures from client side
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => {
    if (!clientShouldLog('debug')) return
    _console.debug(msg, meta ?? '')
    void send('debug', msg, meta)
  },
  info: (msg: string, meta?: unknown) => {
    if (!clientShouldLog('info')) return
    _console.log(msg, meta ?? '')
    void send('info', msg, meta)
  },
  warn: (msg: string, meta?: unknown) => {
    if (!clientShouldLog('warn')) return
    _console.warn(msg, meta ?? '')
    void send('warn', msg, meta)
  },
  error: (msg: string | Error, meta?: unknown) => {
    if (!clientShouldLog('error')) return
    if (msg instanceof Error) {
      _console.error(msg.stack || msg.message)
      const metaObj = meta && typeof meta === 'object' ? (meta as Record<string, any>) : {}
      void send('error', msg.message, { stack: msg.stack, ...metaObj })
    } else {
      _console.error(msg, meta ?? '')
      void send('error', String(msg), meta)
    }
  },
}

export function logAction(component: string, action: string, args?: Record<string, unknown>): void {
  logger.debug(`[${component}] ${action}`, args)
}

export function logUserAction(component: string, action: string, args?: Record<string, unknown>): void {
  logger.info(`[${component}] ${action}`, args)
}

export function logWarn(component: string, condition: string, args?: Record<string, unknown>): void {
  logger.warn(`[${component}] ${condition}`, args)
}

export default logger
