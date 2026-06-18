import express from 'express'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import logger from './logger.js'

// --- Structured error primitives -------------------------------------------
// Canonical error shape `{ error: { code, message } }`. The string-union is
// duplicated in app/types.ts on purpose: server and app have separate tsconfigs
// and cannot share a module.

type ErrorCode = 'AUTH_REQUIRED' | 'BAD_REQUEST' | 'UPSTREAM_ERROR' | 'INTERNAL'

class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public logDetail?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function sendError(res: express.Response, err: unknown): void {
  if (err instanceof ApiError) {
    logger.error(`[${err.code}] ${err.message}`, err.logDetail ?? '')
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  // Unexpected: log the full object server-side, but never leak it to the client.
  logger.error('Unhandled error:', err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } })
}

// --- Startup config ---------------------------------------------------------
let envContent = ''
try {
  envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
} catch {
  logger.error('Could not read .env.local. Create it with TELEMETRY_CONNECTION_STRING="..." (see .env.example)')
  process.exit(1)
}

const connStr = envContent.match(/TELEMETRY_CONNECTION_STRING="([^"]+)"/)?.[1] ?? ''
const appId = connStr.match(/ApplicationId=([^;]+)/)?.[1]?.trim() ?? ''

if (!appId) {
  logger.error('Could not parse ApplicationId from TELEMETRY_CONNECTION_STRING in .env.local')
  process.exit(1)
}

logger.info(`App Insights App ID: ${appId}`)

// --- Azure token acquisition ------------------------------------------------
let cachedToken = ''
let tokenExpiry = 0

function getToken(): string {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken
  let result: string
  try {
    result = execSync(
      'az account get-access-token --resource "https://api.applicationinsights.io/" --query "{token:accessToken,expiry:expiresOn}" -o json'
    ).toString()
  } catch (err) {
    const detail = String((err as { stderr?: Buffer }).stderr ?? (err as Error).message ?? err)
    if (/az login|not logged in|AADSTS|please run/i.test(detail)) {
      throw new ApiError(
        401,
        'AUTH_REQUIRED',
        "Azure CLI is not authenticated. Run 'az login' in the terminal where the server runs, then retry.",
        detail
      )
    }
    throw new ApiError(500, 'INTERNAL', 'Failed to acquire Azure access token', detail)
  }
  const parsed = JSON.parse(result) as { token: string; expiry: string }
  cachedToken = parsed.token
  tokenExpiry = new Date(parsed.expiry).getTime()
  return cachedToken
}

const app = express()
app.use(express.json())

// Mirrors app/types.ts AppInsightsResult (duplicated across the tsconfig boundary).
interface AppInsightsResult {
  tables: unknown[]
  error?: { code?: string; message: string }
}

async function queryAppInsights(query: string): Promise<AppInsightsResult> {
  const token = getToken()
  let response: Response
  try {
    response = await fetch(`https://api.applicationinsights.io/v1/apps/${appId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })
  } catch (err) {
    throw new ApiError(503, 'UPSTREAM_ERROR', 'Cannot reach App Insights API — check network connectivity', String(err))
  }

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 401 || response.status === 403) {
      cachedToken = '' // force a fresh token on the next request
      throw new ApiError(
        401,
        'AUTH_REQUIRED',
        'Azure session is no longer valid. Re-run `az login`, then retry.',
        { status: response.status, body }
      )
    }
    throw new ApiError(
      502,
      'UPSTREAM_ERROR',
      `App Insights returned ${response.status}`,
      { status: response.status, body }
    )
  }

  const raw = await response.text()
  if (!raw) return { tables: [] }

  let data: AppInsightsResult
  try {
    data = JSON.parse(raw) as AppInsightsResult
  } catch {
    throw new ApiError(502, 'UPSTREAM_ERROR', 'App Insights returned non-JSON body', raw.slice(0, 500))
  }

  // App Insights occasionally returns 200 with an in-body error object.
  if (data.error) {
    throw new ApiError(502, 'UPSTREAM_ERROR', data.error.message, data.error)
  }
  return data
}

function requireString(value: unknown, field: string, maxLen = 100_000): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, 'BAD_REQUEST', `Request body must include a non-empty "${field}" string`)
  }
  if (value.length > maxLen) {
    throw new ApiError(400, 'BAD_REQUEST', `"${field}" exceeds the maximum allowed length`)
  }
  return value
}

app.post('/api/query', async (req, res) => {
  try {
    const query = requireString((req.body as { query?: unknown }).query, 'query')
    res.json(await queryAppInsights(query))
  } catch (err) {
    sendError(res, err)
  }
})

app.post('/api/conversation-events', async (req, res) => {
  try {
    const conversationId = requireString(
      (req.body as { conversationId?: unknown }).conversationId,
      'conversationId',
      200
    )
    const safeId = conversationId.replace(/"/g, '')
    const query = `
customEvents
| where customDimensions.conversationId == "${safeId}"
| order by timestamp asc
| project timestamp, name, cloudRoleInstance = cloud_RoleInstance, customDimensions`
    res.json(await queryAppInsights(query))
  } catch (err) {
    sendError(res, err)
  }
})

// Dev-only endpoint for client logs. Guarded so it won't be enabled in production.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/local-log', (req, res) => {
    try {
      const body = req.body as { level?: string; message?: string; meta?: unknown }
      const level = (body.level as 'debug' | 'info' | 'warn' | 'error') || 'info'
      const msg = body.message || '<no message>'
      const meta = body.meta
      switch (level) {
        case 'debug':
          logger.debug(msg, meta)
          break
        case 'warn':
          logger.warn(msg, meta)
          break
        case 'error':
          logger.error(new Error(String(msg)), meta)
          break
        default:
          logger.info(msg, meta)
      }
      res.json({ ok: true })
    } catch (err) {
      logger.error(err as Error)
      res.status(500).json({ error: String(err) })
    }
  })
}

// Catches malformed-JSON body-parser SyntaxErrors (and any other middleware error)
// and returns the canonical error shape instead of a default HTML 500.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, new ApiError(400, 'BAD_REQUEST', 'Request body is not valid JSON'))
    return
  }
  sendError(res, err)
})

app.listen(3001, () => logger.info('App Insights proxy listening on :3001'))

process.on('unhandledRejection', reason => logger.error('unhandledRejection:', reason))
process.on('uncaughtException', err => {
  logger.error('uncaughtException:', err)
  process.exit(1)
})
