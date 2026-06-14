import type { AppInsightsResult, ConversationSummary, ConversationEvent } from './types'

async function runQuery(kql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: kql }),
  })
  const data: AppInsightsResult = await res.json()
  if (data.error) throw new Error(data.error.message)
  const table = data.tables?.[0]
  if (!table) return []
  return table.rows.map(row =>
    Object.fromEntries(table.columns.map((col, i) => [col.name, row[i]]))
  )
}

function parseDynamic(value: unknown): Record<string, string> {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, string>
  try { return JSON.parse(value as string) as Record<string, string> } catch { return {} }
}

function parseSet(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return (value as string[]).filter(Boolean)
  try { return (JSON.parse(value as string) as string[]).filter(Boolean) } catch { return [] }
}

export async function fetchConversations(timeRange = '7d'): Promise<ConversationSummary[]> {
  const kql = `
let phones = customEvents
| where timestamp > ago(${timeRange})
| extend convId = tostring(customDimensions.conversationId)
| where isnotempty(convId)
| extend callerPhone = coalesce(
    tostring(customDimensions.callerPhone),
    tostring(customDimensions.PhoneNumber)
  )
| where isnotempty(callerPhone)
| extend callerPhone = iff(callerPhone startswith "tel:", substring(callerPhone, 4), callerPhone)
| where callerPhone startswith "+"
| summarize callerPhone = any(callerPhone) by convId;
customEvents
| where timestamp > ago(${timeRange})
| where name in ("BotMessageReceived", "BotMessageSend", "OnErrorLog", "TopicStart")
| extend isDesignMode = customDimensions['DesignMode']
| where isDesignMode == "False"
| extend convId = tostring(customDimensions.conversationId)
| where isnotempty(convId)
| extend topicName = tostring(customDimensions.TopicName)
| summarize
    startTime = min(timestamp),
    endTime = max(timestamp),
    messageCount = countif(name == "BotMessageReceived"),
    botMessageCount = countif(name == "BotMessageSend"),
    errorCount = countif(name == "OnErrorLog"),
    topics = make_set_if(topicName, isnotempty(topicName), 20),
    channelId = anyif(tostring(customDimensions.channelId), name == "BotMessageReceived"),
    agentName = any(tostring(cloud_RoleInstance))
  by conversationId = convId
| join kind=leftouter phones on $left.conversationId == $right.convId
| order by startTime desc
| take 500`
  const rows = await runQuery(kql)
  return rows.map(r => {
    const errorCount = (r.errorCount as number) ?? 0
    return {
      conversationId: r.conversationId as string,
      startTime: r.startTime as string,
      endTime: r.endTime as string,
      messageCount: (r.messageCount as number) ?? 0,
      botMessageCount: (r.botMessageCount as number) ?? 0,
      errorCount,
      hasErrors: errorCount > 0,
      topics: parseSet(r.topics),
      channelId: (r.channelId as string) || 'unknown',
      callerPhone: (r.callerPhone as string) || undefined,
      agentName: (r.agentName as string) || undefined,
    }
  })
}

export async function fetchConversationEvents(conversationId: string): Promise<ConversationEvent[]> {
  const res = await fetch('/api/conversation-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  })
  const data: AppInsightsResult = await res.json()
  if (data.error) throw new Error(data.error.message)
  const table = data.tables?.[0]
  if (!table) return []
  return table.rows
    .map(row => Object.fromEntries(table.columns.map((col, i) => [col.name, row[i]])))
    .map(r => ({
      timestamp: r.timestamp as string,
      name: r.name as string,
      cloudRoleInstance: (r.cloudRoleInstance as string) || '',
      customDimensions: parseDynamic(r.customDimensions),
    }))
}
