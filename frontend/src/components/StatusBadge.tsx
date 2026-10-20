import clsx from 'clsx'
import { AlertTriangle, CircleDot, Loader2, PlugZap, ShieldCheck, Sparkles, WifiOff } from 'lucide-react'

import type { GenerationPhase } from '../hooks/useChat'
import type { AIStatus } from '../types'

export type AppState =
  | 'backend_unavailable'
  | 'checking'
  | 'demo'
  | 'ready'
  | 'model_loading'
  | 'generating'
  | 'model_not_found'
  | 'no_models'
  | 'ollama_offline'

export interface StatusDescriptor {
  state: AppState
  label: string
  tone: 'neutral' | 'positive' | 'warning' | 'danger' | 'active'
  detail: string
}

/**
 * Collapses backend status + client generation phase into a single indicator.
 * "Local AI Ready" is only produced when the backend reported `state === "ready"`.
 */
export function deriveStatus(status: AIStatus | null, phase: GenerationPhase, backendReachable: boolean, checking: boolean): StatusDescriptor {
  if (!backendReachable) {
    return {
      state: 'backend_unavailable',
      label: 'Backend Unavailable',
      tone: 'danger',
      detail: 'The local FastAPI server is not responding. Start it and the app will reconnect automatically.',
    }
  }
  if (phase === 'waiting') {
    const label = status?.provider === 'ollama' ? 'Model Loading' : 'Preparing Reply'
    return { state: 'model_loading', label, tone: 'active', detail: 'Waiting for the first token. Large models take a moment to load into memory.' }
  }
  if (phase === 'streaming') {
    return { state: 'generating', label: 'Generating Response', tone: 'active', detail: 'Tokens are streaming from the local engine.' }
  }
  if (!status) {
    return {
      state: 'checking',
      label: checking ? 'Checking' : 'Unknown',
      tone: 'neutral',
      detail: 'Verifying the local inference service.',
    }
  }
  switch (status.state) {
    case 'demo':
      return { state: 'demo', label: 'Demo Mode', tone: 'neutral', detail: status.message }
    case 'ready':
      return { state: 'ready', label: 'Local AI Ready', tone: 'positive', detail: status.message }
    case 'model_not_found':
      return { state: 'model_not_found', label: 'Model Not Found', tone: 'warning', detail: status.message }
    case 'no_models':
      return { state: 'no_models', label: 'No Models Installed', tone: 'warning', detail: status.message }
    case 'offline':
      return { state: 'ollama_offline', label: 'Ollama Offline', tone: 'danger', detail: status.message }
    default:
      return { state: 'checking', label: 'Checking', tone: 'neutral', detail: status.message }
  }
}

const toneClasses = {
  neutral: 'border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200',
  positive: 'border-moss-200 bg-moss-50 text-moss-800 dark:border-moss-800 dark:bg-moss-950 dark:text-moss-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  danger: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200',
  active: 'border-moss-300 bg-moss-100 text-moss-900 dark:border-moss-700 dark:bg-moss-900 dark:text-moss-100',
}

const icons: Record<AppState, typeof Sparkles> = {
  backend_unavailable: WifiOff,
  checking: Loader2,
  demo: Sparkles,
  ready: ShieldCheck,
  model_loading: Loader2,
  generating: CircleDot,
  model_not_found: AlertTriangle,
  no_models: AlertTriangle,
  ollama_offline: PlugZap,
}

export function StatusBadge({ descriptor, compact = false, className }: { descriptor: StatusDescriptor; compact?: boolean; className?: string }) {
  const Icon = icons[descriptor.state]
  const spinning = descriptor.state === 'checking' || descriptor.state === 'model_loading'
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        toneClasses[descriptor.tone],
        className,
      )}
      title={descriptor.detail}
      data-state={descriptor.state}
      role="status"
    >
      <Icon className={clsx('size-3.5', spinning && 'animate-spin', descriptor.state === 'generating' && 'animate-pulse')} aria-hidden />
      {!compact && descriptor.label}
    </span>
  )
}
