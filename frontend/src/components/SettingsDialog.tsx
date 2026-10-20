import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useApp, type Theme } from '../hooks/AppContext'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, limits, defaultSystemPrompt, updateSettings, theme, setTheme, clearAllConversations, models, status } = useApp()
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [stream, setStream] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (!open || !settings) return
    setTemperature(settings.temperature)
    setMaxTokens(settings.max_tokens)
    setSystemPrompt(settings.system_prompt)
    setStream(settings.stream)
  }, [open, settings])

  const save = async () => {
    setSaving(true)
    try {
      await updateSettings({ temperature, max_tokens: maxTokens, system_prompt: systemPrompt, stream })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Settings"
        description="These values are stored in the local SQLite database."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving} disabled={!settings}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold">Appearance</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'system', label: 'System', icon: Monitor },
                ] as const
              ).map((option) => {
                const Icon = option.icon
                const active = theme === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id as Theme)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${active ? 'border-moss-400 bg-moss-50 text-moss-900 dark:border-moss-600 dark:bg-moss-950 dark:text-moss-100' : 'hover:bg-[var(--surface-sunken)]'}`}
                  >
                    <Icon className="size-4" />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">Inference</h3>
            <p className="text-muted mt-1 text-xs">
              Current engine:{' '}
              {settings?.provider === 'demo'
                ? 'Demo Mode (scripted replies)'
                : settings?.model
                  ? `Ollama · ${settings.model}`
                  : 'Ollama · no model selected'}
              {status?.ollama.available ? ` · ${models.length} installed` : ' · Ollama not reachable'}
            </p>
            <label className="mt-4 block text-sm">
              <span className="flex justify-between">
                Temperature
                <span className="font-mono text-xs tabular-nums">{temperature.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={limits.temperature_min}
                max={limits.temperature_max}
                step={0.05}
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
                className="mt-2 w-full accent-moss-600"
              />
              <span className="text-muted text-xs">Lower is more focused; higher is more varied.</span>
            </label>
            <label className="mt-4 block text-sm">
              <span className="flex justify-between">
                Maximum output tokens
                <span className="font-mono text-xs tabular-nums">{maxTokens}</span>
              </span>
              <input
                type="range"
                min={limits.max_tokens_min}
                max={limits.max_tokens_max}
                step={16}
                value={maxTokens}
                onChange={(event) => setMaxTokens(Number(event.target.value))}
                className="mt-2 w-full accent-moss-600"
              />
            </label>
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 accent-moss-600" checked={stream} onChange={(event) => setStream(event.target.checked)} />
              <span>
                Stream responses
                <span className="text-muted mt-0.5 block text-xs">Show tokens as they arrive instead of waiting for the full reply.</span>
              </span>
            </label>
          </section>

          <section>
            <h3 className="text-sm font-semibold">System prompt</h3>
            <textarea
              className="surface-sunken mt-2 h-28 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-moss-400"
              value={systemPrompt}
              maxLength={limits.system_prompt_max_chars}
              onChange={(event) => setSystemPrompt(event.target.value)}
            />
            <div className="mt-1 flex items-center justify-between">
              <button type="button" className="text-muted text-xs underline" onClick={() => setSystemPrompt(defaultSystemPrompt)}>
                Restore default
              </button>
              <span className="text-muted text-[11px] tabular-nums">
                {systemPrompt.length} / {limits.system_prompt_max_chars}
              </span>
            </div>
          </section>

          <section className="rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/30">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Danger zone</h3>
            <p className="mt-1 text-xs leading-relaxed text-red-800/80 dark:text-red-200/80">
              Clear every conversation stored in the local database. Settings and installed models are not affected.
            </p>
            <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmClear(true)}>
              Clear all conversation history
            </Button>
          </section>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmClear}
        title="Clear all conversation history?"
        description="Every chat on this device will be deleted from the local SQLite database. This cannot be undone."
        confirmLabel="Clear all"
        destructive
        onConfirm={async () => {
          await clearAllConversations()
        }}
        onClose={() => setConfirmClear(false)}
      />
    </>
  )
}
