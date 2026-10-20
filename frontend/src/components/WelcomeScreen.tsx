import { PlugZap, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { useApp } from '../hooks/AppContext'
import { api } from '../services/api'
import { LogoMark } from './Logo'
import { Button } from './ui/Button'

export function WelcomeScreen() {
  const { completeOnboarding, updateSettings, status, refreshStatus, statusChecking } = useApp()
  const [busy, setBusy] = useState<'demo' | 'local' | null>(null)
  const ollamaReady = Boolean(status?.ollama.available)

  const startDemo = async () => {
    setBusy('demo')
    try {
      await updateSettings({ provider: 'demo' })
      completeOnboarding()
    } finally {
      setBusy(null)
    }
  }

  const connectLocal = async () => {
    setBusy('local')
    try {
      const next = await refreshStatus()
      if (next?.ollama.available) {
        const listed = await api.models()
        const pick =
          (next.selected_model && listed.models.some((m) => m.name === next.selected_model) ? next.selected_model : null) ??
          listed.models[0]?.name ??
          next.suggested_model
        await updateSettings({ provider: 'ollama', model: pick })
      }
      completeOnboarding()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-lg text-center animate-rise-in">
        <LogoMark className="mx-auto size-16" />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Welcome to Slow and Steady</h1>
        <p className="text-muted mt-3 text-base leading-relaxed">
          Your personal AI workspace, powered by open-source intelligence and built around your privacy.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void startDemo()}
            disabled={busy !== null}
            className="surface-raised flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-colors hover:border-moss-300 hover:bg-moss-50 disabled:opacity-60 dark:hover:border-moss-700 dark:hover:bg-moss-950/40"
          >
            <Sparkles className="size-5 text-moss-600" />
            <span className="font-medium">Start Demo</span>
            <span className="text-muted text-sm leading-relaxed">
              Explore the interface with scripted replies. No model required.
            </span>
          </button>
          <button
            type="button"
            onClick={() => void connectLocal()}
            disabled={busy !== null}
            className="surface-raised flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-colors hover:border-moss-300 hover:bg-moss-50 disabled:opacity-60 dark:hover:border-moss-700 dark:hover:bg-moss-950/40"
          >
            <PlugZap className="size-5 text-moss-600" />
            <span className="font-medium">Connect Local AI</span>
            <span className="text-muted text-sm leading-relaxed">
              {ollamaReady
                ? 'Ollama is running on this computer. Choose an installed model to start chatting.'
                : 'Look for Ollama on this computer. You can still use Demo Mode if it is not installed yet.'}
            </span>
          </button>
        </div>

        {!ollamaReady && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">Ollama is not running</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
              <li>
                Install Ollama from{' '}
                <a className="underline" href="https://ollama.com" target="_blank" rel="noopener noreferrer">
                  ollama.com
                </a>
                .
              </li>
              <li>
                Start it, then pull a small model: <code className="rounded bg-amber-100 px-1 font-mono text-[12px] dark:bg-amber-900">ollama pull qwen2.5:1.5b</code>
              </li>
              <li>Return here and choose Connect Local AI again — or Start Demo while you wait.</li>
            </ol>
          </div>
        )}

        <div className="mt-6">
          <Button variant="ghost" size="sm" onClick={() => void refreshStatus()} loading={statusChecking} disabled={busy !== null}>
            Recheck local AI
          </Button>
        </div>
      </div>
    </div>
  )
}
