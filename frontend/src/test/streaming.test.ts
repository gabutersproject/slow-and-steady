import { describe, expect, it, vi } from 'vitest'

import { streamEvents } from '../services/api'

describe('streamEvents', () => {
  it('yields accepted, start, delta and done events in order', async () => {
    const body = [
      'event: accepted',
      'data: {"conversation":{"id":"abc"},"user_message":{"id":"u1","content":"hi"}}',
      '',
      'event: start',
      'data: {"conversation_id":"abc","assistant_message_id":"a1","provider":"demo","model":"demo-scripted"}',
      '',
      'event: delta',
      'data: {"content":"Hel"}',
      '',
      'event: delta',
      'data: {"content":"lo"}',
      '',
      'event: done',
      'data: {"message":{"id":"a1","content":"Hello"},"cancelled":false}',
      '',
    ].join('\n')

    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    )

    const events = []
    for await (const event of streamEvents('/chat/stream', '{}', new AbortController().signal)) {
      events.push(event.event)
    }
    expect(events).toEqual(['accepted', 'start', 'delta', 'delta', 'done'])
    vi.unstubAllGlobals()
  })

  it('stops when the abort signal fires before the request', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return new Response('', { status: 200 })
    })
    await expect(async () => {
      const iterator = streamEvents('/chat/stream', '{}', controller.signal)
      await iterator.next()
    }).rejects.toThrow(/AbortError|Aborted/)
    vi.unstubAllGlobals()
  })
})
