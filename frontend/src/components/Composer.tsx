import { Eraser, Send, Square } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent } from 'react'

import { useApp } from '../hooks/AppContext'
import { Button, IconButton } from './ui/Button'

interface ComposerProps {
  draft: string
  onDraftChange: (value: string) => void
}

/**
 * Multiline input: Enter sends, Shift+Enter inserts a newline.
 * Character count is shown as the user approaches the limit.
 */
export function Composer({ draft, onDraftChange }: ComposerProps) {
  const { sendMessage, stopGeneration, isGenerating, limits, phase } = useApp()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const max = limits.message_max_chars
  const overLimit = draft.length > max
  const nearLimit = draft.length > max * 0.85
  const canSend = draft.trim().length > 0 && !overLimit && !isGenerating

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [draft])

  const submit = () => {
    if (!canSend) return
    const text = draft
    onDraftChange('')
    void sendMessage(text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-5 sm:px-8">
      <div className="surface-raised rounded-2xl border shadow-sm focus-within:border-moss-400 dark:focus-within:border-moss-600">
        <label htmlFor="message-input" className="sr-only">
          Message
        </label>
        <textarea
          id="message-input"
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything, or paste text to summarise."
          className="block w-full resize-none bg-transparent px-4 pt-3 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-[var(--text-muted)]"
          maxLength={max + 200}
          disabled={isGenerating && phase === 'waiting'}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-1">
            {draft.length > 0 && (
              <IconButton label="Clear input" size="sm" onClick={() => onDraftChange('')}>
                <Eraser className="size-3.5" />
              </IconButton>
            )}
            <span
              className={`px-1.5 text-[11px] tabular-nums ${overLimit ? 'text-red-600' : nearLimit ? 'text-amber-600' : 'text-muted'}`}
              aria-live="polite"
            >
              {draft.length.toLocaleString()} / {max.toLocaleString()}
            </span>
          </div>
          {isGenerating ? (
            <Button variant="danger" size="sm" icon={<Square className="size-3.5" />} onClick={() => void stopGeneration()}>
              Stop
            </Button>
          ) : (
            <Button size="sm" icon={<Send className="size-3.5" />} onClick={submit} disabled={!canSend} aria-label="Send message">
              Send
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted mt-2 text-center text-[11px]">
        Enter to send · Shift+Enter for a new line · replies stay on this computer
      </p>
    </div>
  )
}
