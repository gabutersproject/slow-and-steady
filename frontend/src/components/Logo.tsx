import clsx from 'clsx'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={clsx('shrink-0', className)} aria-hidden>
      <rect width="64" height="64" rx="16" className="fill-moss-800 dark:fill-moss-500" />
      <path d="M18 38c0-8 6-14 14-14s14 6 14 14" className="stroke-moss-100 dark:stroke-moss-950" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="40" r="4" className="fill-moss-100 dark:fill-moss-950" />
      <path d="M14 44h36" className="stroke-moss-300 dark:stroke-moss-900" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-8" />
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Slow and Steady</p>
          <p className="text-muted text-[11px]">Local, open-source AI</p>
        </div>
      )}
    </div>
  )
}
