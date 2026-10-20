import { ArrowDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useApp } from '../hooks/AppContext'
import { MessageBubble } from './MessageBubble'
import { Button } from './ui/Button'

export function MessageList({ dark }: { dark: boolean }) {
  const { messages, isGenerating, regenerate, loadingMessages } = useApp()
  const containerRef = useRef<HTMLDivElement>(null)
  const [stickToBottom, setStickToBottom] = useState(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current
    if (!el) return
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior })
    else el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (stickToBottom) scrollToBottom(isGenerating ? 'auto' : 'smooth')
  }, [messages, isGenerating, stickToBottom, scrollToBottom])

  const onScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    setStickToBottom(distance < 80)
  }

  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i].role === 'assistant') return i
    return -1
  })()

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={containerRef} onScroll={onScroll} className="scrollbar-thin h-full overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {loadingMessages && messages.length === 0 && (
            <div className="space-y-4" aria-label="Loading messages">
              <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-[var(--surface-sunken)]" />
              <div className="h-24 w-3/4 animate-pulse rounded-2xl bg-[var(--surface-sunken)]" />
            </div>
          )}
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              dark={dark}
              isLast={index === messages.length - 1 && index === lastAssistantIndex}
              canRegenerate={!isGenerating}
              onRegenerate={() => void regenerate()}
            />
          ))}
        </div>
      </div>
      {!stickToBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button variant="secondary" size="sm" className="pointer-events-auto shadow-md" icon={<ArrowDown className="size-3.5" />} onClick={() => { setStickToBottom(true); scrollToBottom() }}>
            Latest
          </Button>
        </div>
      )}
    </div>
  )
}
