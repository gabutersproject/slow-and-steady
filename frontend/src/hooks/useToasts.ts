import { useCallback, useRef, useState } from 'react'

export type ToastTone = 'error' | 'info' | 'success'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

export function useToasts(autoDismissMs = 6000) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = ++counter.current
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, description }])
      if (autoDismissMs > 0) window.setTimeout(() => dismiss(id), autoDismissMs)
      return id
    },
    [autoDismissMs, dismiss],
  )

  return { toasts, push, dismiss }
}
