import { Menu } from 'lucide-react'

import { useApp } from '../hooks/AppContext'
import { deriveStatus, StatusBadge } from './StatusBadge'
import { IconButton } from './ui/Button'

interface ChatHeaderProps {
  onOpenMobile: () => void
}

export function ChatHeader({ onOpenMobile }: ChatHeaderProps) {
  const { status, phase, backendReachable, statusChecking, conversations, activeConversationId } = useApp()
  const descriptor = deriveStatus(status, phase, backendReachable, statusChecking)
  const title = conversations.find((c) => c.id === activeConversationId)?.title ?? 'New chat'

  return (
    <header className="flex items-center gap-3 border-b px-3 py-2.5 sm:px-5">
      <IconButton label="Open menu" className="md:hidden" onClick={onOpenMobile}>
        <Menu className="size-5" />
      </IconButton>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        <p className="text-muted hidden truncate text-[11px] sm:block">{descriptor.detail}</p>
      </div>
      <StatusBadge descriptor={descriptor} />
    </header>
  )
}
