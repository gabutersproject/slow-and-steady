import clsx from 'clsx'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

import type { Toast } from '../../hooks/useToasts'

const icons = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
}

const tones = {
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/70 dark:text-red-100',
  success: 'border-moss-200 bg-moss-50 text-moss-900 dark:border-moss-800 dark:bg-moss-950 dark:text-moss-100',
  info: 'border-stone-200 bg-white text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100',
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = icons[toast.tone]
        return (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={clsx(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-rise-in',
              tones[toast.tone],
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{toast.title}</p>
              {toast.description && <p className="mt-0.5 opacity-80">{toast.description}</p>}
            </div>
            <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss" className="rounded-md p-0.5 opacity-60 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
