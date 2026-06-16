import express from 'express'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import logger from './logger'

const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
const connStr = envContent.match(/TELEMETRY_CONNECTION_STRING="([^"]+)"/)?.[1] ?? ''
const appId = connStr.match(/ApplicationId=([^;]+)/)?.[1]?.trim() ?? ''

if (!appId) {
  logger.error('Could not parse ApplicationId from TELEMETRY_CONNECTION_STRING in .env.local')
  process.exit(1)
}

logger.info(`App Insights App ID: ${appId}`)

let cachedToken = ''
let tokenExpiry = 0

function getToken(): string {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken
  const result = execSync(
    'az account get-access-token --resource "https://api.applicationinsights.io/" --query "{token:accessToken,expiry:expiresOn}" -o json'
  ).toString()
  const parsed = JSON.parse(result) as { token: string; expiry: string }
  cachedToken = parsed.token
  tokenExpiry = new Date(parsed.expiry).getTime()
  return cachedToken
}

const app = express()
app.use(express.json())

async function queryAppInsights(query: string): Promise<unknown> {
  const token = getToken()
  const response = await fetch(`https://api.applicationinsights.io/v1/apps/${appId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  return response.json()
}

app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body as { query: string }
    res.json(await queryAppInsights(query))
  } catch (err) {
    logger.error(err as Error)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/conversation-events', async (req, res) => {
  try {
    const { conversationId } = req.body as { conversationId: string }
    const safeId = conversationId.replace(/"/g, '')
    const query = `
customEvents
| where customDimensions.conversationId == "${safeId}"
| order by timestamp asc
| project timestamp, name, cloudRoleInstance = cloud_RoleInstance, customDimensions`
    res.json(await queryAppInsights(query))
  } catch (err) {
    logger.error(err as Error)
    res.status(500).json({ error: String(err) })
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

app.listen(3001, () => logger.info('App Insights proxy listening on :3001'))
