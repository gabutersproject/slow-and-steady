import { useCallback, useEffect, useState } from 'react'

import { api } from '../services/api'
import type { AppSettings, SettingsLimits } from '../types'

export const FALLBACK_LIMITS: SettingsLimits = {
  temperature_min: 0,
  temperature_max: 2,
  max_tokens_min: 16,
  max_tokens_max: 8192,
  system_prompt_max_chars: 4000,
  message_max_chars: 8000,
}

export function useSettings(onError: (error: unknown) => void) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [limits, setLimits] = useState<SettingsLimits>(FALLBACK_LIMITS)
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const response = await api.getSettings()
      setSettings(response.settings)
      setLimits(response.limits)
      setDefaultSystemPrompt(response.default_system_prompt)
      return response.settings
    } catch (error) {
      onError(error)
      return null
    } finally {
      setLoading(false)
    }
  }, [onError])

  const update = useCallback(
    async (patch: Partial<AppSettings>) => {
      const response = await api.updateSettings(patch)
      setSettings(response.settings)
      setLimits(response.limits)
      return response.settings
    },
    [],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { settings, limits, defaultSystemPrompt, loading, refresh, update }
}
