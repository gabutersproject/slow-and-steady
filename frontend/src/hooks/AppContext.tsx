import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'

import { describeError } from '../services/api'
import type { AIStatus, AppSettings, ConversationSummary, ModelInfo, SettingsLimits, UIMessage } from '../types'
import { useAIStatus } from './useAIStatus'
import { useChat, type GenerationPhase } from './useChat'
import { useConversations } from './useConversations'
import { useLocalStorage } from './useLocalStorage'
import { useSettings } from './useSettings'
import { useToasts, type Toast, type ToastTone } from './useToasts'

export type Theme = 'light' | 'dark' | 'system'

export interface AppContextValue {
  // settings
  settings: AppSettings | null
  limits: SettingsLimits
  defaultSystemPrompt: string
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings | null>
  // engine status
  status: AIStatus | null
  models: ModelInfo[]
  modelsMessage: string | null
  statusChecking: boolean
  backendReachable: boolean
  refreshStatus: () => Promise<AIStatus | null>
  // conversations
  conversations: ConversationSummary[]
  conversationsLoading: boolean
  activeConversationId: string | null
  selectConversation: (id: string | null) => void
  startNewChat: () => void
  renameConversation: (id: string, title: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  clearAllConversations: () => Promise<number>
  // chat
  messages: UIMessage[]
  loadingMessages: boolean
  phase: GenerationPhase
  isGenerating: boolean
  sendMessage: (text: string) => Promise<void>
  regenerate: () => Promise<void>
  stopGeneration: () => Promise<void>
  // ui
  onboarded: boolean
  completeOnboarding: () => void
  theme: Theme
  setTheme: (theme: Theme) => void
  toasts: Toast[]
  notify: (tone: ToastTone, title: string, description?: string) => void
  dismissToast: (id: number) => void
  reportError: (error: unknown) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { toasts, push, dismiss } = useToasts()
  const [onboarded, setOnboarded] = useLocalStorage<boolean>('sas:onboarded', false)
  const [theme, setTheme] = useLocalStorage<Theme>('sas:theme', 'system')
  const [activeConversationId, setActiveConversationId] = useLocalStorage<string | null>('sas:active-conversation', null)

  const reportError = useCallback(
    (error: unknown) => {
      push('error', describeError(error))
    },
    [push],
  )

  const settingsState = useSettings(reportError)
  const statusState = useAIStatus()
  const conversationsState = useConversations(reportError)

  const chat = useChat({
    activeConversationId,
    setActiveConversationId,
    streamingEnabled: settingsState.settings?.stream ?? true,
    onConversationUpdated: conversationsState.upsert,
    onError: reportError,
  })

  useEffect(() => {
    const root = document.documentElement
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    const dark = theme === 'dark' || (theme === 'system' && prefersDark)
    root.classList.toggle('dark', dark)
  }, [theme])

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      try {
        const next = await settingsState.update(patch)
        void statusState.refresh()
        return next
      } catch (error) {
        reportError(error)
        return null
      }
    },
    [reportError, settingsState, statusState],
  )

  const selectConversation = useCallback(
    (id: string | null) => {
      if (chat.isGenerating) {
        push('info', 'A reply is still being generated', 'Stop it before switching conversations.')
        return
      }
      setActiveConversationId(id)
    },
    [chat.isGenerating, push, setActiveConversationId],
  )

  const startNewChat = useCallback(() => {
    if (chat.isGenerating) {
      push('info', 'A reply is still being generated', 'Stop it before starting a new chat.')
      return
    }
    setActiveConversationId(null)
    chat.resetMessages()
  }, [chat, push, setActiveConversationId])

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        await conversationsState.rename(id, title)
      } catch (error) {
        reportError(error)
      }
    },
    [conversationsState, reportError],
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        if (id === activeConversationId && chat.isGenerating) await chat.stopGeneration()
        await conversationsState.remove(id)
        if (id === activeConversationId) {
          setActiveConversationId(null)
          chat.resetMessages()
        }
        push('success', 'Conversation deleted')
      } catch (error) {
        reportError(error)
      }
    },
    [activeConversationId, chat, conversationsState, push, reportError, setActiveConversationId],
  )

  const clearAllConversations = useCallback(async () => {
    try {
      if (chat.isGenerating) await chat.stopGeneration()
      const deleted = await conversationsState.clearAll()
      setActiveConversationId(null)
      chat.resetMessages()
      push('success', deleted === 1 ? '1 conversation cleared' : `${deleted} conversations cleared`)
      return deleted
    } catch (error) {
      reportError(error)
      return 0
    }
  }, [chat, conversationsState, push, reportError, setActiveConversationId])

  const value = useMemo<AppContextValue>(
    () => ({
      settings: settingsState.settings,
      limits: settingsState.limits,
      defaultSystemPrompt: settingsState.defaultSystemPrompt,
      updateSettings,
      status: statusState.status,
      models: statusState.models,
      modelsMessage: statusState.modelsMessage,
      statusChecking: statusState.checking,
      backendReachable: statusState.backendReachable,
      refreshStatus: statusState.refresh,
      conversations: conversationsState.conversations,
      conversationsLoading: conversationsState.loading,
      activeConversationId,
      selectConversation,
      startNewChat,
      renameConversation,
      deleteConversation,
      clearAllConversations,
      messages: chat.messages,
      loadingMessages: chat.loadingMessages,
      phase: chat.phase,
      isGenerating: chat.isGenerating,
      sendMessage: chat.sendMessage,
      regenerate: chat.regenerate,
      stopGeneration: chat.stopGeneration,
      onboarded,
      completeOnboarding: () => setOnboarded(true),
      theme,
      setTheme,
      toasts,
      notify: push,
      dismissToast: dismiss,
      reportError,
    }),
    [
      activeConversationId,
      chat.isGenerating,
      chat.loadingMessages,
      chat.messages,
      chat.phase,
      chat.regenerate,
      chat.sendMessage,
      chat.stopGeneration,
      clearAllConversations,
      conversationsState.conversations,
      conversationsState.loading,
      deleteConversation,
      dismiss,
      onboarded,
      push,
      renameConversation,
      reportError,
      selectConversation,
      setOnboarded,
      setTheme,
      settingsState.defaultSystemPrompt,
      settingsState.limits,
      settingsState.settings,
      startNewChat,
      statusState.checking,
      statusState.backendReachable,
      statusState.models,
      statusState.modelsMessage,
      statusState.refresh,
      statusState.status,
      theme,
      toasts,
      updateSettings,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside <AppProvider>')
  return context
}
