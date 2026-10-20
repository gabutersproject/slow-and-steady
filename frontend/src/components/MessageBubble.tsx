import clsx from 'clsx'
import { AlertTriangle, Check, Copy, RefreshCw, Sparkles, Square, User } from 'lucide-react'
import { memo, useState } from 'react'

import { copyToClipboard } from '../services/clipboard'
import type { UIMessage } from '../types'
import { LogoMark } from './Logo'
import { Markdown } from './Markdown'
import { IconButton } from './ui/Button'

interface MessageBubbleProps {
  message: UIMessage
  dark: boolean
  isLast: boolean
  canRegenerate: boolean
  onRegenerate: () => void
}

export const MessageBubble = memo(function MessageBubble({ message, dark, isLast, canRegenerate, onRegenerate }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (await copyToClipboard(message.content)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <article
      className={clsx('group flex gap-3 animate-rise-in', isUser ? 'flex-row-reverse' : 'flex-row')}
      data-role={message.role}
      data-status={message.status}
      aria-label={isUser ? 'Your message' : 'Assistant message'}
    >
      <div
        className={clsx(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-100' : '',
        )}
        aria-hidden
      >
        {isUser ? <User className="size-4" /> : <LogoMark className="size-8" />}
      </div>

      <div className={clsx('flex min-w-0 max-w-[85%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        {!isUser && (
          <div className="text-muted flex items-center gap-1.5 px-1 text-[11px]">
            <span className="font-medium">{message.provider === 'demo' ? 'Demo' : 'Assistant'}</span>
            {message.provider === 'demo' ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-1.5 py-px dark:border-stone-600">
                <Sparkles className="size-3" /> scripted, not an AI model
              </span>
            ) : (
              message.model && <span className="font-mono">{message.model}</span>
            )}
          </div>
        )}

        <div
          className={clsx(
            'rounded-2xl px-4 py-2.5',
            isUser
              ? 'rounded-tr-md bg-moss-700 text-white dark:bg-moss-600'
              : 'surface-raised rounded-tl-md border',
            message.status === 'error' && 'border-red-300 dark:border-red-800',
          )}
        >
          {isUser ? (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <div className={clsx(message.status === 'streaming' && 'streaming-caret')}>
              <Markdown content={message.content} dark={dark} />
            </div>
          ) : message.status === 'streaming' ? (
            <ThinkingDots />
          ) : (
            <p className="text-muted text-sm italic">No text was produced.</p>
          )}
        </div>

        {!isUser && message.status === 'cancelled' && (
          <p className="text-muted flex items-center gap-1 px-1 text-[11px]">
            <Square className="size-3" /> Stopped before the reply finished.
          </p>
        )}
        {!isUser && message.status === 'error' && (
          <p className="flex items-center gap-1 px-1 text-[11px] text-red-600 dark:text-red-400">
            <AlertTriangle className="size-3" /> Generation failed; this text is incomplete.
          </p>
        )}

        {message.status !== 'streaming' && (
          <div className={clsx('flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100', isLast && !isUser && 'opacity-100')}>
            <IconButton label={copied ? 'Copied' : 'Copy message'} size="sm" onClick={() => void copy()}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </IconButton>
            {!isUser && isLast && (
              <IconButton label="Regenerate response" size="sm" onClick={onRegenerate} disabled={!canRegenerate}>
                <RefreshCw className="size-3.5" />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </article>
  )
})

export function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Waiting for the model">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 rounded-full bg-moss-500 animate-pulse-dot" style={{ animationDelay: `${i * 0.16}s` }} />
      ))}
    </span>
  )
}
