import clsx from 'clsx'
import { Check, MessageSquare, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { useApp } from '../hooks/AppContext'
import type { ConversationSummary } from '../types'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { IconButton } from './ui/Button'

export function ConversationList() {
  const { conversations, conversationsLoading, activeConversationId, selectConversation, renameConversation, deleteConversation } = useApp()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null)

  if (conversationsLoading) {
    return (
      <ul className="space-y-1 px-2" aria-label="Loading conversations">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-9 animate-pulse rounded-lg bg-[var(--surface-sunken)]" />
        ))}
      </ul>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <MessageSquare className="text-muted mx-auto size-5" aria-hidden />
        <p className="text-muted mt-2 text-xs leading-relaxed">No conversations yet. Your history stays on this device.</p>
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-0.5 px-2" aria-label="Chat history">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            {editingId === conversation.id ? (
              <RenameRow
                initial={conversation.title}
                onCancel={() => setEditingId(null)}
                onSave={async (title) => {
                  await renameConversation(conversation.id, title)
                  setEditingId(null)
                }}
              />
            ) : (
              <div
                className={clsx(
                  'group flex items-center gap-1 rounded-lg pr-1 transition-colors',
                  conversation.id === activeConversationId
                    ? 'bg-moss-100 text-moss-900 dark:bg-moss-900/60 dark:text-moss-100'
                    : 'hover:bg-[var(--surface-sunken)]',
                )}
              >
                <button
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
                  aria-current={conversation.id === activeConversationId ? 'page' : undefined}
                  title={conversation.title}
                >
                  {conversation.title}
                </button>
                <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <IconButton label={`Rename "${conversation.title}"`} size="sm" onClick={() => setEditingId(conversation.id)}>
                    <Pencil className="size-3.5" />
                  </IconButton>
                  <IconButton label={`Delete "${conversation.title}"`} size="sm" tone="danger" onClick={() => setPendingDelete(conversation)}>
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this conversation?"
        description={`"${pendingDelete?.title ?? ''}" and its ${pendingDelete?.message_count ?? 0} messages will be removed from the local database. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (pendingDelete) await deleteConversation(pendingDelete.id)
        }}
        onClose={() => setPendingDelete(null)}
      />
    </>
  )
}

function RenameRow({ initial, onSave, onCancel }: { initial: string; onSave: (title: string) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const save = async () => {
    const trimmed = title.trim()
    if (!trimmed || trimmed === initial) return onCancel()
    await onSave(trimmed)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void save()
    if (event.key === 'Escape') onCancel()
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-[var(--surface-sunken)] pr-1">
      <input
        ref={inputRef}
        aria-label="Conversation title"
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <IconButton label="Save title" size="sm" onClick={() => void save()}>
        <Check className="size-3.5" />
      </IconButton>
      <IconButton label="Cancel rename" size="sm" onClick={onCancel}>
        <X className="size-3.5" />
      </IconButton>
    </div>
  )
}
