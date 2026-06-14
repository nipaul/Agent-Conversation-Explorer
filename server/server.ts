import express from 'express'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
const connStr = envContent.match(/TELEMETRY_CONNECTION_STRING="([^"]+)"/)?.[1] ?? ''
const appId = connStr.match(/ApplicationId=([^;]+)/)?.[1]?.trim() ?? ''

if (!appId) {
  console.error('Could not parse ApplicationId from TELEMETRY_CONNECTION_STRING in .env.local')
  process.exit(1)
}

console.log(`App Insights App ID: ${appId}`)

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
    console.error(err)
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
    console.error(err)
    res.status(500).json({ error: String(err) })
  }
})

app.listen(7726, () => console.log('App Insights proxy listening on :7726'))
