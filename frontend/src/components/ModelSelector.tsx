import { Cpu, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { useApp } from '../hooks/AppContext'
import { IconButton } from './ui/Button'

const DEMO_VALUE = '__demo__'

export function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`
}

/**
 * Lets the user pick between Demo Mode and any model that is already installed
 * in Ollama. Nothing is downloaded from here; missing models are only hinted at.
 */
export function ModelSelector({ compact = false }: { compact?: boolean }) {
  const { settings, models, status, modelsMessage, updateSettings, refreshStatus, statusChecking, isGenerating } = useApp()
  const [saving, setSaving] = useState(false)

  const value = settings?.provider === 'demo' ? DEMO_VALUE : (settings?.model ?? '')
  const selectedMissing = settings?.provider === 'ollama' && settings.model && !models.some((m) => m.name === settings.model)

  const handleChange = async (next: string) => {
    setSaving(true)
    try {
      if (next === DEMO_VALUE) await updateSettings({ provider: 'demo' })
      else await updateSettings({ provider: 'ollama', model: next })
    } finally {
      setSaving(false)
    }
  }

  if (compact) {
    return (
      <div className="flex justify-center" title={settings?.provider === 'demo' ? 'Demo Mode' : (settings?.model ?? 'No model selected')}>
        {settings?.provider === 'demo' ? <Sparkles className="size-5 text-[var(--text-muted)]" /> : <Cpu className="size-5 text-[var(--text-muted)]" />}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor="model-select" className="text-muted text-[11px] font-semibold tracking-wide uppercase">
          Model
        </label>
        <IconButton label="Refresh models" size="sm" onClick={() => void refreshStatus()} disabled={statusChecking}>
          <RefreshCw className={statusChecking ? 'size-3.5 animate-spin' : 'size-3.5'} />
        </IconButton>
      </div>
      <select
        id="model-select"
        className="surface-raised h-9 w-full rounded-lg border px-2.5 text-sm disabled:opacity-60"
        value={value}
        disabled={saving || isGenerating || !settings}
        onChange={(event) => void handleChange(event.target.value)}
      >
        <option value={DEMO_VALUE}>Demo Mode (scripted replies)</option>
        <optgroup label={status?.ollama.available ? `Installed in Ollama (${models.length})` : 'Ollama (offline)'}>
          {models.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name}
              {model.parameter_size ? ` · ${model.parameter_size}` : ''}
              {model.size_bytes ? ` · ${formatBytes(model.size_bytes)}` : ''}
            </option>
          ))}
          {selectedMissing && settings?.model && (
            <option value={settings.model} disabled>
              {settings.model} (not installed)
            </option>
          )}
        </optgroup>
      </select>
      {models.length === 0 && (
        <p className="text-muted text-xs leading-relaxed">
          {modelsMessage ?? 'Connect Ollama to list installed models.'}
        </p>
      )}
    </div>
  )
}
