// Mirrors the Pydantic schemas in backend/app/schemas.

export type ProviderName = 'demo' | 'ollama'
export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageStatus = 'complete' | 'cancelled' | 'error'

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  status: MessageStatus
  provider: string | null
  model: string | null
  created_at: string
}

/** A message as held in UI state; `streaming` only exists on the client. */
export interface UIMessage extends Omit<Message, 'status'> {
  status: MessageStatus | 'streaming'
}

export interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationDetail extends ConversationSummary {
  messages: Message[]
}

export interface AppSettings {
  provider: ProviderName
  model: string | null
  temperature: number
  max_tokens: number
  system_prompt: string
  stream: boolean
}

export interface SettingsLimits {
  temperature_min: number
  temperature_max: number
  max_tokens_min: number
  max_tokens_max: number
  system_prompt_max_chars: number
  message_max_chars: number
}

export interface SettingsResponse {
  settings: AppSettings
  limits: SettingsLimits
  default_system_prompt: string
}

export type AIState = 'demo' | 'ready' | 'checking' | 'offline' | 'no_models' | 'model_not_found'

export interface ModelInfo {
  name: string
  size_bytes: number | null
  parameter_size: string | null
  quantization: string | null
  family: string | null
  modified_at: string | null
}

export interface OllamaStatus {
  available: boolean
  base_url: string
  version: string | null
  model_count: number
  error: string | null
}

export interface AIStatus {
  provider: ProviderName
  state: AIState
  selected_model: string | null
  model_available: boolean
  message: string
  ollama: OllamaStatus
  suggested_model: string
}

export interface ModelsResponse {
  provider: ProviderName
  ollama_available: boolean
  models: ModelInfo[]
  selected_model: string | null
  suggested_model: string
  message: string | null
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  app: string
  version: string
  database: 'ok' | 'unavailable'
}

export interface GenerationOverrides {
  model?: string | null
  temperature?: number
  max_tokens?: number
  system_prompt?: string
}

export interface ChatRequest {
  conversation_id?: string | null
  message: string
  options?: GenerationOverrides
}

export interface ChatResponse {
  conversation: ConversationSummary
  user_message: Message | null
  assistant_message: Message
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: Record<string, unknown>
}

// Server-sent events emitted by /api/chat/stream and /regenerate.
export type StreamEvent =
  | { event: 'accepted'; data: { conversation: ConversationSummary; user_message: Message | null } }
  | { event: 'start'; data: { conversation_id: string; assistant_message_id: string; provider: string; model: string | null } }
  | { event: 'delta'; data: { content: string } }
  | { event: 'done'; data: { message: Message | null; conversation: ConversationSummary | null; cancelled: boolean } }
  | { event: 'error'; data: ApiErrorPayload & { status_code?: number; partial_message?: Message | null } }
