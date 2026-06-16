type Level = 'debug' | 'info' | 'warn' | 'error'

const SERVER_LOG_ENDPOINT = '/api/local-log'
const SEND_TO_SERVER = import.meta.env.MODE !== 'production'

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
    console.debug(msg, meta ?? '')
    void send('debug', msg, meta)
  },
  info: (msg: string, meta?: unknown) => {
    console.log(msg, meta ?? '')
    void send('info', msg, meta)
  },
  warn: (msg: string, meta?: unknown) => {
    console.warn(msg, meta ?? '')
    void send('warn', msg, meta)
  },
  error: (msg: string | Error, meta?: unknown) => {
    if (msg instanceof Error) {
      console.error(msg.stack || msg.message)
      const metaObj = meta && typeof meta === 'object' ? (meta as Record<string, any>) : {}
      void send('error', msg.message, { stack: msg.stack, ...metaObj })
    } else {
      console.error(msg, meta ?? '')
      void send('error', String(msg), meta)
    }
  },
}

export default logger
