/**
 * Thin client for the local backend. All requests go to the same origin under
 * `/api`, which the Vite dev server proxies to the FastAPI process on localhost.
 */

import type {
  AIStatus,
  ApiErrorPayload,
  ChatRequest,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
  GenerationOverrides,
  HealthResponse,
  ModelsResponse,
  SettingsResponse,
  StreamEvent,
} from '../types'

export const API_BASE = '/api'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiError'
    this.code = payload.code
    this.status = status
    this.details = payload.details
  }
}

/** Raised when the backend process itself cannot be reached. */
export class BackendUnavailableError extends Error {
  constructor() {
    super('The local backend is not running. Start it with the backend start script and try again.')
    this.name = 'BackendUnavailableError'
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: ApiErrorPayload }
    if (body?.error?.message) return new ApiError(response.status, body.error)
  } catch {
    // fall through
  }
  return new ApiError(response.status, { code: 'http_error', message: `Request failed with status ${response.status}.` })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new BackendUnavailableError()
  }
  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  aiStatus: () => request<AIStatus>('/ai/status'),
  models: () => request<ModelsResponse>('/ai/models'),

  listConversations: () => request<ConversationSummary[]>('/conversations'),
  createConversation: (title?: string) =>
    request<ConversationSummary>('/conversations', { method: 'POST', body: JSON.stringify(title ? { title } : {}) }),
  getConversation: (id: string) => request<ConversationDetail>(`/conversations/${encodeURIComponent(id)}`),
  renameConversation: (id: string, title: string) =>
    request<ConversationSummary>(`/conversations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => request<void>(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  deleteAllConversations: () => request<{ deleted: number }>('/conversations?confirm=true', { method: 'DELETE' }),

  getSettings: () => request<SettingsResponse>('/settings'),
  updateSettings: (patch: Partial<SettingsResponse['settings']>) =>
    request<SettingsResponse>('/settings', { method: 'PUT', body: JSON.stringify(patch) }),

  chat: (body: ChatRequest, signal?: AbortSignal) =>
    request<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify(body), signal }),
  regenerate: (conversationId: string, options?: GenerationOverrides, signal?: AbortSignal) =>
    request<ChatResponse>(`/chat/${encodeURIComponent(conversationId)}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ stream: false, options }),
      signal,
    }),
  cancel: (conversationId: string) =>
    request<{ cancelled: boolean }>(`/chat/${encodeURIComponent(conversationId)}/cancel`, { method: 'POST' }),

  chatStream: (body: ChatRequest, signal: AbortSignal) =>
    streamEvents('/chat/stream', JSON.stringify(body), signal),
  regenerateStream: (conversationId: string, options: GenerationOverrides | undefined, signal: AbortSignal) =>
    streamEvents(`/chat/${encodeURIComponent(conversationId)}/regenerate`, JSON.stringify({ stream: true, options }), signal),
}

/** Parse a `text/event-stream` body into typed events. */
export async function* streamEvents(path: string, body: string, signal: AbortSignal): AsyncGenerator<StreamEvent> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body,
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new BackendUnavailableError()
  }
  if (!response.ok) throw await parseError(response)
  if (!response.body) throw new ApiError(500, { code: 'stream_error', message: 'The server did not return a stream.' })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let separator: number
      while ((separator = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, separator)
        buffer = buffer.slice(separator + 2)
        const event = parseSseBlock(block)
        if (event) yield event
      }
    }
    const tail = parseSseBlock(buffer)
    if (tail) yield tail
  } finally {
    reader.releaseLock()
  }
}

export function parseSseBlock(block: string): StreamEvent | null {
  let name: string | null = null
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (!name || dataLines.length === 0) return null
  try {
    return { event: name, data: JSON.parse(dataLines.join('\n')) } as StreamEvent
  } catch {
    return null
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError || error instanceof BackendUnavailableError) return error.message
  if (error instanceof DOMException && error.name === 'AbortError') return 'Generation stopped.'
  if (error instanceof Error) return error.message
  return 'Something unexpected happened.'
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
