import { describe, expect, it } from 'vitest'

import { parseSseBlock, describeError, ApiError, BackendUnavailableError } from './api'

describe('parseSseBlock', () => {
  it('parses a JSON event', () => {
    const event = parseSseBlock('event: delta\ndata: {"content":"Hello"}')
    expect(event).toEqual({ event: 'delta', data: { content: 'Hello' } })
  })

  it('joins multiline data payloads', () => {
    const event = parseSseBlock('event: done\ndata: {"message":{"content":"a"}}\n')
    expect(event?.event).toBe('done')
  })

  it('returns null for comments and empty blocks', () => {
    expect(parseSseBlock(': heartbeat')).toBeNull()
    expect(parseSseBlock('')).toBeNull()
    expect(parseSseBlock('event: delta\ndata: not-json')).toBeNull()
  })
})

describe('describeError', () => {
  it('uses API and backend error messages', () => {
    expect(describeError(new ApiError(503, { code: 'provider_unavailable', message: 'Ollama is not reachable.' }))).toBe(
      'Ollama is not reachable.',
    )
    expect(describeError(new BackendUnavailableError())).toMatch(/backend is not running/)
  })

  it('treats abort as a stop, not a failure', () => {
    expect(describeError(new DOMException('Aborted', 'AbortError'))).toBe('Generation stopped.')
  })
})
