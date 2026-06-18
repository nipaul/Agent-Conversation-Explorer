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

// Canonical structured error contract shared (by duplication) with the server.
// `NETWORK` is frontend-only — the server never emits it.
export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'BAD_REQUEST'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL'
  | 'NETWORK'

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string }
}

export interface AuthStatus {
  loggedIn: boolean
  name?: string
  subscription?: string
  tenantId?: string
  tenantDisplayName?: string
}

export interface AppStatus {
  appId: string
  region: string
}

export interface DeviceCodeInfo {
  deviceCodeUrl?: string
  userCode?: string
  loggedIn?: boolean
}

export interface EnvSettings {
  TELEMETRY_CONNECTION_STRING: string
  LOG_PATH: string
  LOG_LEVEL: string
}

export interface ConnectionTestResult {
  ok: boolean
  message?: string
}

export interface FolderPickerResult {
  cancelled: boolean
  path?: string
}
