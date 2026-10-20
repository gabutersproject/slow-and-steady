import { useCallback, useEffect, useRef, useState } from 'react'

import { api, BackendUnavailableError } from '../services/api'
import type { AIStatus, ModelInfo } from '../types'

const POLL_INTERVAL_MS = 20_000

/**
 * Polls the backend for the AI engine state. `status` is only ever "ready" when
 * the backend has verified that Ollama is reachable and the model is installed.
 */
export function useAIStatus() {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsMessage, setModelsMessage] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [backendReachable, setBackendReachable] = useState(true)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return null
    inFlight.current = true
    setChecking(true)
    try {
      const [nextStatus, nextModels] = await Promise.all([api.aiStatus(), api.models()])
      setStatus(nextStatus)
      setModels(nextModels.models)
      setModelsMessage(nextModels.message)
      setBackendReachable(true)
      return nextStatus
    } catch (error) {
      if (error instanceof BackendUnavailableError) {
        setBackendReachable(false)
      }
      return null
    } finally {
      inFlight.current = false
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { status, models, modelsMessage, checking, backendReachable, refresh }
}
