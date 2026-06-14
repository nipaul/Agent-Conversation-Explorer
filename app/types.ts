export interface ConversationSummary {
  conversationId: string
  startTime: string
  endTime: string
  messageCount: number
  botMessageCount: number
  errorCount: number
  hasErrors: boolean
  topics: string[]
  channelId: string
  callerPhone?: string
  agentName?: string
}

export interface ConversationEvent {
  timestamp: string
  name: string
  cloudRoleInstance: string
  customDimensions: Record<string, string>
}

export interface AppInsightsTable {
  name: string
  columns: Array<{ name: string; type: string }>
  rows: unknown[][]
}

export interface AppInsightsResult {
  tables: AppInsightsTable[]
  error?: { message: string }
}
