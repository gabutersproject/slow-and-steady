import { useCallback, useEffect, useRef, useState } from 'react'

import { api, isAbortError } from '../services/api'
import type { ConversationSummary, Message, StreamEvent, UIMessage } from '../types'

export type GenerationPhase = 'idle' | 'waiting' | 'streaming'

interface UseChatOptions {
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  streamingEnabled: boolean
  onConversationUpdated: (conversation: ConversationSummary) => void
  onError: (error: unknown) => void
}

function toUIMessage(message: Message): UIMessage {
  return { ...message }
}

/**
 * Owns the message list for the active conversation plus the send / stop /
 * regenerate flows. Generation state is tracked explicitly so the UI never
 * presents a reply as finished unless the backend said so.
 */
export function useChat({ activeConversationId, setActiveConversationId, streamingEnabled, onConversationUpdated, onError }: UseChatOptions) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [phase, setPhase] = useState<GenerationPhase>('idle')
  const abortRef = useRef<AbortController | null>(null)
  const generatingConversationRef = useRef<string | null>(null)
  const loadedConversationRef = useRef<string | null>(null)

  // Load history when the active conversation changes (unless we are mid-generation in it).
  useEffect(() => {
    let cancelled = false
    if (!activeConversationId) {
      setMessages([])
      loadedConversationRef.current = null
      return
    }
    if (generatingConversationRef.current === activeConversationId || loadedConversationRef.current === activeConversationId) return
    setLoadingMessages(true)
    setMessages([])
    api
      .getConversation(activeConversationId)
      .then((detail) => {
        if (cancelled) return
        loadedConversationRef.current = activeConversationId
        setMessages(detail.messages.map(toUIMessage))
      })
      .catch((error) => {
        if (cancelled) return
        onError(error)
        setActiveConversationId(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeConversationId, onError, setActiveConversationId])

  const updateMessage = useCallback((id: string, patch: Partial<UIMessage> | ((m: UIMessage) => UIMessage)) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? (typeof patch === 'function' ? patch(m) : { ...m, ...patch }) : m)))
  }, [])

  const consumeStream = useCallback(
    async (events: AsyncGenerator<StreamEvent>, conversationIdHint: string | null) => {
      let assistantId: string | null = null
      let conversationId = conversationIdHint
      for await (const event of events) {
        switch (event.event) {
          case 'accepted': {
            conversationId = event.data.conversation.id
            generatingConversationRef.current = conversationId
            loadedConversationRef.current = conversationId
            onConversationUpdated(event.data.conversation)
            setActiveConversationId(conversationId)
            if (event.data.user_message) {
              const userMessage = toUIMessage(event.data.user_message)
              setMessages((prev) => [...prev.filter((m) => !m.id.startsWith('pending-')), userMessage])
            }
            break
          }
          case 'start': {
            assistantId = event.data.assistant_message_id
            const placeholder: UIMessage = {
              id: assistantId,
              conversation_id: event.data.conversation_id,
              role: 'assistant',
              content: '',
              status: 'streaming',
              provider: event.data.provider,
              model: event.data.model,
              created_at: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, placeholder])
            break
          }
          case 'delta': {
            setPhase('streaming')
            if (assistantId) {
              const id = assistantId
              updateMessage(id, (m) => ({ ...m, content: m.content + event.data.content }))
            }
            break
          }
          case 'done': {
            const finalMessage = event.data.message
            if (finalMessage && assistantId) {
              updateMessage(assistantId, toUIMessage(finalMessage))
            } else if (assistantId) {
              updateMessage(assistantId, { status: 'cancelled' })
            }
            if (event.data.conversation) onConversationUpdated(event.data.conversation)
            break
          }
          case 'error': {
            if (assistantId) {
              const partial = event.data.partial_message
              if (partial) updateMessage(assistantId, toUIMessage(partial))
              else setMessages((prev) => prev.filter((m) => m.id !== assistantId))
            }
            const error = Object.assign(new Error(event.data.message), { code: event.data.code, name: 'ApiError' })
            onError(error)
            break
          }
        }
      }
      return conversationId
    },
    [onConversationUpdated, onError, setActiveConversationId, updateMessage],
  )

  const runGeneration = useCallback(
    async (task: (signal: AbortSignal) => Promise<string | null>, conversationIdHint: string | null) => {
      const controller = new AbortController()
      abortRef.current = controller
      generatingConversationRef.current = conversationIdHint
      setPhase('waiting')
      try {
        await task(controller.signal)
      } catch (error) {
        if (isAbortError(error)) {
          // Partial output is persisted server-side as "cancelled"; mirror that locally.
          setMessages((prev) =>
            prev
              .map((m) => (m.status === 'streaming' ? { ...m, status: 'cancelled' as const } : m))
              .filter((m) => !m.id.startsWith('pending-')),
          )
        } else {
          setMessages((prev) => prev.filter((m) => m.status !== 'streaming' && !m.id.startsWith('pending-')))
          onError(error)
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        generatingConversationRef.current = null
        setPhase('idle')
      }
    },
    [onError],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || phase !== 'idle') return
      const conversationId = activeConversationId
      const pending: UIMessage = {
        id: `pending-${Date.now()}`,
        conversation_id: conversationId ?? '',
        role: 'user',
        content,
        status: 'complete',
        provider: null,
        model: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, pending])

      await runGeneration(async (signal) => {
        if (streamingEnabled) {
          return consumeStream(api.chatStream({ conversation_id: conversationId, message: content }, signal), conversationId)
        }
        const response = await api.chat({ conversation_id: conversationId, message: content }, signal)
        loadedConversationRef.current = response.conversation.id
        onConversationUpdated(response.conversation)
        setActiveConversationId(response.conversation.id)
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== pending.id),
          ...(response.user_message ? [toUIMessage(response.user_message)] : []),
          toUIMessage(response.assistant_message),
        ])
        return response.conversation.id
      }, conversationId)
    },
    [activeConversationId, consumeStream, onConversationUpdated, phase, runGeneration, setActiveConversationId, streamingEnabled],
  )

  const regenerate = useCallback(async () => {
    if (!activeConversationId || phase !== 'idle') return
    const conversationId = activeConversationId
    // Drop the trailing assistant reply locally; the server does the same.
    setMessages((prev) => {
      const next = [...prev]
      while (next.length && next[next.length - 1].role === 'assistant') next.pop()
      return next
    })
    await runGeneration(async (signal) => {
      if (streamingEnabled) {
        return consumeStream(api.regenerateStream(conversationId, undefined, signal), conversationId)
      }
      const response = await api.regenerate(conversationId, undefined, signal)
      onConversationUpdated(response.conversation)
      setMessages((prev) => [...prev, toUIMessage(response.assistant_message)])
      return conversationId
    }, conversationId)
  }, [activeConversationId, consumeStream, onConversationUpdated, phase, runGeneration, streamingEnabled])

  const stopGeneration = useCallback(async () => {
    const conversationId = generatingConversationRef.current
    abortRef.current?.abort()
    if (conversationId) {
      try {
        await api.cancel(conversationId)
      } catch {
        // The abort above already closed the stream; the server stops on disconnect.
      }
    }
  }, [])

  const resetMessages = useCallback(() => {
    setMessages([])
    loadedConversationRef.current = null
  }, [])

  return {
    messages,
    loadingMessages,
    phase,
    isGenerating: phase !== 'idle',
    sendMessage,
    regenerate,
    stopGeneration,
    resetMessages,
  }
}
