import clsx from 'clsx'
import { Info, PanelLeftClose, PanelLeftOpen, Plus, Settings, X } from 'lucide-react'

import { useApp } from '../hooks/AppContext'
import { ConversationList } from './ConversationList'
import { Wordmark } from './Logo'
import { ModelSelector } from './ModelSelector'
import { Button, IconButton } from './ui/Button'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  onOpenSettings: () => void
  onOpenAbout: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, onOpenSettings, onOpenAbout }: SidebarProps) {
  const { startNewChat } = useApp()

  const handleNewChat = () => {
    startNewChat()
    onCloseMobile()
  }

  const renderContent = (collapsed: boolean) => (
    <div className="flex h-full flex-col">
      <div className={clsx('flex items-center border-b px-3 py-3', collapsed ? 'justify-center' : 'justify-between')}>
        <Wordmark compact={collapsed} />
        <div className="flex items-center gap-1">
          <IconButton label="Close menu" className="md:hidden" onClick={onCloseMobile}>
            <X className="size-4" />
          </IconButton>
          {!collapsed && (
            <IconButton label="Collapse sidebar" className="hidden md:inline-flex" onClick={onToggleCollapsed}>
              <PanelLeftClose className="size-4" />
            </IconButton>
          )}
        </div>
      </div>

      <div className={clsx('px-3 pt-3', collapsed && 'flex flex-col items-center gap-2')}>
        {collapsed ? (
          <>
            <IconButton label="Expand sidebar" onClick={onToggleCollapsed}>
              <PanelLeftOpen className="size-4" />
            </IconButton>
            <IconButton label="New chat" onClick={handleNewChat}>
              <Plus className="size-4" />
            </IconButton>
          </>
        ) : (
          <Button className="w-full" icon={<Plus className="size-4" />} onClick={handleNewChat}>
            New chat
          </Button>
        )}
      </div>

      <div className="scrollbar-thin mt-3 flex-1 overflow-y-auto pb-2">
        {collapsed ? (
          <div className="flex justify-center pt-2">
            <ModelSelector compact />
          </div>
        ) : (
          <>
            <p className="text-muted px-5 pb-1.5 text-[11px] font-semibold tracking-wide uppercase">History</p>
            <ConversationList />
          </>
        )}
      </div>

      <div className={clsx('border-t px-3 py-3', collapsed ? 'flex flex-col items-center gap-1' : 'space-y-3')}>
        {!collapsed && <ModelSelector />}
        <div className={clsx('flex', collapsed ? 'flex-col gap-1' : 'gap-1')}>
          {collapsed ? (
            <>
              <IconButton label="Settings" onClick={onOpenSettings}>
                <Settings className="size-4" />
              </IconButton>
              <IconButton label="About" onClick={onOpenAbout}>
                <Info className="size-4" />
              </IconButton>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="flex-1 justify-start" icon={<Settings className="size-4" />} onClick={onOpenSettings}>
                Settings
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 justify-start" icon={<Info className="size-4" />} onClick={onOpenAbout}>
                About
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside
        className={clsx(
          'surface-raised hidden h-full shrink-0 border-r transition-[width] duration-200 md:block',
          collapsed ? 'w-[68px]' : 'w-72',
        )}
        aria-label="Sidebar"
      >
        {renderContent(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="presentation">
          <div className="absolute inset-0 bg-stone-900/40 animate-fade-in" onClick={onCloseMobile} aria-hidden />
          <aside className="surface-raised absolute inset-y-0 left-0 w-[85vw] max-w-xs border-r shadow-xl animate-rise-in" aria-label="Sidebar">
            {renderContent(false)}
          </aside>
        </div>
      )}
    </>
  )
}
