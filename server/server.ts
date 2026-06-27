import express from 'express'
import { execSync, spawn, spawnSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
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

// Inject LOG_PATH and LOG_LEVEL from .env.local into process.env so the logger
// picks them up before it's first used. These are read dynamically per write.
for (const key of ['LOG_PATH', 'LOG_LEVEL'] as const) {
  const m = envContent.match(new RegExp(`^(?!\\s*#)${key}="?([^"\\n]*)"?`, 'm'))
  const val = m?.[1]?.trim()
  if (val) process.env[key] = val
}

let connStr = envContent.match(/TELEMETRY_CONNECTION_STRING="([^"]+)"/)?.[1] ?? ''
let appId = connStr.match(/ApplicationId=([^;]+)/)?.[1]?.trim() ?? ''

if (!appId) {
  logger.error('Could not parse ApplicationId from TELEMETRY_CONNECTION_STRING in .env.local')
  process.exit(1)
}

logger.info(`App Insights App ID: ${appId}`)

// --- Env file helpers -------------------------------------------------------

const SETTINGS_ALLOWLIST = ['TELEMETRY_CONNECTION_STRING', 'LOG_PATH', 'LOG_LEVEL'] as const
type SettingsKey = typeof SETTINGS_ALLOWLIST[number]

function readEnvFile(): string {
  return readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
}

function parseEnvValues(content: string): Record<SettingsKey, string> {
  const result: Record<string, string> = {}
  for (const key of SETTINGS_ALLOWLIST) {
    const match = content.match(new RegExp(`^(?!\\s*#)${key}="?([^"\\n]*)"?`, 'm'))
    result[key] = match?.[1]?.trim() ?? ''
  }
  return result as Record<SettingsKey, string>
}

function updateEnvFile(updates: Partial<Record<SettingsKey, string>>): void {
  let content = readEnvFile()
  for (const [key, value] of Object.entries(updates) as [SettingsKey, string][]) {
    const quoted = `${key}="${value}"`
    const quotedRx = new RegExp(`^([ \\t]*${key}=)"[^"\\n]*"`, 'm')
    const unquotedRx = new RegExp(`^([ \\t]*${key}=)[^"\\s\\n][^\\n]*`, 'm')
    if (quotedRx.test(content)) content = content.replace(quotedRx, quoted)
    else if (unquotedRx.test(content)) content = content.replace(unquotedRx, quoted)
    else content = content.trimEnd() + '\n' + quoted + '\n'
  }
  writeFileSync(resolve(process.cwd(), '.env.local'), content, 'utf-8')
}

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
let convId = "${safeId}";
let convEvents = customEvents | where customDimensions.conversationId == convId;
let tStart = toscalar(convEvents | summarize min(timestamp));
let tEnd   = toscalar(convEvents | summarize max(timestamp));
let opIds  = toscalar(convEvents | summarize make_set(operation_Id));
convEvents
| project timestamp, name, cloudRoleInstance = cloud_RoleInstance, customDimensions
| union (
    dependencies
    | where (customDimensions.conversationId == convId)
         or (timestamp between (tStart .. tEnd) and operation_Id in (opIds))
    | project
        timestamp,
        name              = strcat("_dep:", type, ":", name),
        cloudRoleInstance = cloud_RoleInstance,
        customDimensions  = bag_merge(
            customDimensions,
            pack(
                "_table",      "dependencies",
                "_target",     target,
                "_type",       type,
                "_duration",   tostring(tolong(duration)),
                "_success",    tostring(success),
                "_resultCode", resultCode,
                "_data",       data
            )
        )
  )
| order by timestamp asc`
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

app.get('/api/auth-status', (_req, res) => {
  try {
    const raw = execSync('az account show -o json').toString()
    const acct = JSON.parse(raw) as {
      user: { name: string }
      name: string
      tenantId: string
      tenantDisplayName?: string
    }
    res.json({
      loggedIn: true,
      name: acct.user.name,
      subscription: acct.name,
      tenantId: acct.tenantId,
      tenantDisplayName: acct.tenantDisplayName,
    })
  } catch {
    res.json({ loggedIn: false })
  }
})

app.get('/api/app-status', (_req, res) => {
  const region = connStr.match(/IngestionEndpoint=https:\/\/([^.]+)\./)?.[1] ?? ''
  res.json({ appId, region })
})

app.post('/api/auth-login', (_req, res) => {
  const isWin = process.platform === 'win32'
  const proc = spawn(isWin ? 'cmd' : 'az', isWin ? ['/c', 'az', 'login', '--use-device-code'] : ['login', '--use-device-code'])
  let responded = false

  function tryExtract(text: string) {
    if (responded) return
    const m = text.match(/open the page (https:\/\/\S+) and enter the code (\S+)/i)
    if (m) { responded = true; res.json({ deviceCodeUrl: m[1], userCode: m[2] }) }
  }

  proc.stdout.on('data', (c: Buffer) => tryExtract(c.toString()))
  proc.stderr.on('data', (c: Buffer) => tryExtract(c.toString()))
  proc.on('error', err => {
    if (!responded) { responded = true; sendError(res, new ApiError(500, 'INTERNAL', 'Failed to start az login', String(err))) }
  })
  proc.on('close', code => {
    if (!responded) {
      responded = true
      if (code === 0) res.json({ loggedIn: true })
      else sendError(res, new ApiError(500, 'INTERNAL', 'az login failed'))
    }
  })
  setTimeout(() => {
    if (!responded) {
      responded = true
      proc.kill()
      sendError(res, new ApiError(500, 'INTERNAL', 'Timed out waiting for device code'))
    }
  }, 15_000)
})

app.post('/api/test-connection', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>
    const connStr = typeof body.connectionString === 'string' ? body.connectionString.trim() : ''
    if (!connStr) throw new ApiError(400, 'BAD_REQUEST', 'connectionString is required')

    const testAppId = connStr.match(/ApplicationId=([^;]+)/)?.[1]?.trim() ?? ''
    if (!testAppId) throw new ApiError(400, 'BAD_REQUEST', 'Could not parse ApplicationId from connection string')

    const token = getToken()
    const response = await fetch(
      `https://api.applicationinsights.io/v1/apps/${testAppId}/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'customEvents | take 1' }),
      }
    )

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        res.json({ ok: false, message: 'Access denied — the logged-in Azure identity does not have access to this App Insights resource. Check that you are signed into the correct tenant.' })
      } else {
        const text = await response.text()
        res.json({ ok: false, message: `App Insights returned ${response.status}: ${text.slice(0, 200)}` })
      }
      return
    }

    res.json({ ok: true })
  } catch (err) {
    if (err instanceof ApiError && err.code === 'AUTH_REQUIRED') {
      res.json({ ok: false, message: 'Not logged in to Azure. Use the Login button above first.' })
      return
    }
    sendError(res, err)
  }
})

app.post('/api/auth-logout', (_req, res) => {
  try {
    execSync('az logout')
    cachedToken = ''
    tokenExpiry = 0
    res.json({ ok: true })
  } catch (err) {
    sendError(res, new ApiError(500, 'INTERNAL', 'az logout failed', String(err)))
  }
})

app.get('/api/settings', (_req, res) => {
  try {
    res.json({ settings: parseEnvValues(readEnvFile()) })
  } catch (err) {
    sendError(res, new ApiError(500, 'INTERNAL', 'Could not read .env.local', String(err)))
  }
})

app.post('/api/settings', (req, res) => {
  try {
    const body = req.body as Record<string, unknown>
    const updates: Partial<Record<SettingsKey, string>> = {}
    for (const key of SETTINGS_ALLOWLIST) {
      if (!(key in body)) continue
      const val = body[key]
      if (typeof val !== 'string') throw new ApiError(400, 'BAD_REQUEST', `"${key}" must be a string`)
      if (key === 'LOG_LEVEL' && !['debug', 'info', 'warn', 'error'].includes(val))
        throw new ApiError(400, 'BAD_REQUEST', 'LOG_LEVEL must be debug | info | warn | error')
      if (val.includes('\n') || val.includes('\r'))
        throw new ApiError(400, 'BAD_REQUEST', `"${key}" value must not contain newlines`)
      updates[key] = val
    }
    if (!Object.keys(updates).length) throw new ApiError(400, 'BAD_REQUEST', 'No valid settings keys provided')
    updateEnvFile(updates)
    if (updates.LOG_PATH) {
      mkdirSync(updates.LOG_PATH, { recursive: true })
    }
    if (updates.TELEMETRY_CONNECTION_STRING) {
      const newAppId = updates.TELEMETRY_CONNECTION_STRING.match(/ApplicationId=([^;]+)/)?.[1]?.trim() ?? ''
      if (newAppId) {
        connStr = updates.TELEMETRY_CONNECTION_STRING
        appId = newAppId
        cachedToken = ''
        tokenExpiry = 0
        logger.info(`App Insights switched to App ID: ${appId}`)
      }
    }
    logger.info('Settings updated', { keys: Object.keys(updates) })
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err)
  }
})

app.get('/api/browse-folder', (_req, res) => {
  try {
    let selectedPath = ''
    if (process.platform === 'win32') {
      const ps = spawnSync('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = "Select log folder"; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $f.SelectedPath }',
      ], { encoding: 'utf-8', timeout: 60_000 })
      selectedPath = ps.stdout?.trim() ?? ''
    } else if (process.platform === 'darwin') {
      selectedPath = execSync(
        'osascript -e \'POSIX path of (choose folder with prompt "Select log folder")\'',
        { timeout: 60_000 }
      ).toString().trim().replace(/\/$/, '')
    } else {
      throw new ApiError(400, 'BAD_REQUEST', 'Folder picker is not supported on this platform')
    }
    if (!selectedPath) {
      res.json({ cancelled: true })
    } else {
      res.json({ cancelled: false, path: selectedPath })
    }
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err); return }
    sendError(res, new ApiError(500, 'INTERNAL', 'Folder picker failed', String(err)))
  }
})

// Catches malformed-JSON body-parser SyntaxErrors (and any other middleware error)
// and returns the canonical error shape instead of a default HTML 500.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, new ApiError(400, 'BAD_REQUEST', 'Request body is not valid JSON'))
    return
  }
  sendError(res, err)
})

app.listen(7726, () => logger.info('App Insights proxy listening on :7726'))

process.on('unhandledRejection', reason => logger.error('unhandledRejection:', reason))
process.on('uncaughtException', err => {
  logger.error('uncaughtException:', err)
  process.exit(1)
})
