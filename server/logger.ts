import { appendFileSync, mkdirSync } from 'fs'
import { dirname, parse, sep } from 'path'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const levelPriority: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const DEFAULT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
const LOG_PATH = process.env.LOG_PATH || './logs/app.log'
const INCLUDE_STACK = process.env.LOG_INCLUDE_STACK !== 'false'

const SENSITIVE_KEYS = ['password', 'pwd', 'token', 'accessToken', 'authorization', 'phone', 'phoneNumber', 'ssn']

function shouldLog(level: LogLevel) {
  const current = (process.env.LOG_LEVEL as LogLevel) || DEFAULT_LEVEL
  return levelPriority[level] >= levelPriority[current]
}

function dateSuffix() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function rotatedPath(basePath: string) {
  const p = parse(basePath)
  const suffix = dateSuffix()
  const name = p.name ? `${p.name}-${suffix}` : `${suffix}`
  const ext = p.ext || '.log'
  return `${p.dir ? p.dir + sep : ''}${name}${ext}`
}

function maskValue(key: string, value: any): any {
  if (value == null) return value
  if (typeof value === 'string') {
    // mask phone-like strings
    if (/\+?\d[\d\s\-()]{6,}\d/.test(value) && /phone|phoneNumber/i.test(key)) {
      return value.replace(/\d(?=\d{4})/g, '*')
    }
    return value
  }
  return value
}

function maskObject(obj: any): any {
  if (obj == null) return obj
  if (Array.isArray(obj)) return obj.map(maskObject)
  if (typeof obj !== 'object') return obj
  const out: any = {}
  for (const k of Object.keys(obj)) {
    try {
      if (SENSITIVE_KEYS.includes(k)) {
        out[k] = '***'
      } else {
        out[k] = maskObject(obj[k])
      }
    } catch {
      out[k] = '***'
    }
  }
  return out
}

function writeLogToFile(level: LogLevel, msg: string, meta?: unknown) {
  try {
    const target = rotatedPath(LOG_PATH)
    mkdirSync(dirname(target), { recursive: true })
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: msg,
      meta: meta ? maskObject(meta) : undefined,
    }
    appendFileSync(target, JSON.stringify(entry) + '\n')
  } catch (err) {
    // If file logging fails, at least print to console
    // eslint-disable-next-line no-console
    console.error('Failed to write log to file', String(err))
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => {
    if (!shouldLog('debug')) return
    // eslint-disable-next-line no-console
    console.debug(msg, meta ?? '')
    writeLogToFile('debug', msg, meta)
  },
  info: (msg: string, meta?: unknown) => {
    if (!shouldLog('info')) return
    // eslint-disable-next-line no-console
    console.log(msg, meta ?? '')
    writeLogToFile('info', msg, meta)
  },
  warn: (msg: string, meta?: unknown) => {
    if (!shouldLog('warn')) return
    // eslint-disable-next-line no-console
    console.warn(msg, meta ?? '')
    writeLogToFile('warn', msg, meta)
  },
  error: (msg: string | Error, meta?: unknown) => {
    if (!shouldLog('error')) return
    if (msg instanceof Error) {
      // eslint-disable-next-line no-console
      console.error(msg.stack || msg.message)
      writeLogToFile('error', msg.message, INCLUDE_STACK ? { stack: msg.stack, ...(meta as object) } : meta)
    } else {
      // eslint-disable-next-line no-console
      console.error(msg, meta ?? '')
      writeLogToFile('error', String(msg), meta)
    }
  },
}

export default logger
