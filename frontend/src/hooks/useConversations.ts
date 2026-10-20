import { useCallback, useEffect, useState } from 'react'

import { api } from '../services/api'
import type { ConversationSummary } from '../types'

export function useConversations(onError: (error: unknown) => void) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const list = await api.listConversations()
      setConversations(list)
      return list
    } catch (error) {
      onError(error)
      return null
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Insert or update a conversation and keep the list sorted by recency. */
  const upsert = useCallback((conversation: ConversationSummary) => {
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== conversation.id)
      return [conversation, ...rest].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    })
  }, [])

  const rename = useCallback(
    async (id: string, title: string) => {
      const updated = await api.renameConversation(id, title)
      upsert(updated)
      return updated
    },
    [upsert],
  )

  const remove = useCallback(async (id: string) => {
    await api.deleteConversation(id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const clearAll = useCallback(async () => {
    const result = await api.deleteAllConversations()
    setConversations([])
    return result.deleted
  }, [])

  return { conversations, loading, refresh, upsert, rename, remove, clearAll }
}
