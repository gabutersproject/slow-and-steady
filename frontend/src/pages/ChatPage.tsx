import { useMemo, useState } from 'react'

import { AboutDialog } from '../components/AboutDialog'
import { ChatHeader } from '../components/ChatHeader'
import { Composer } from '../components/Composer'
import { EmptyState } from '../components/EmptyState'
import { MessageList } from '../components/MessageList'
import { SettingsDialog } from '../components/SettingsDialog'
import { Sidebar } from '../components/Sidebar'
import { WelcomeScreen } from '../components/WelcomeScreen'
import { useApp } from '../hooks/AppContext'
import { useLocalStorage } from '../hooks/useLocalStorage'

export function ChatPage() {
  const { onboarded, messages, theme } = useApp()
  const [collapsed, setCollapsed] = useLocalStorage('sas:sidebar-collapsed', false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const dark = useMemo(() => {
    if (theme === 'dark') return true
    if (theme === 'light') return false
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  }, [theme])

  const pickPrompt = (prompt: string) => {
    setDraft(prompt)
    window.requestAnimationFrame(() => {
      document.getElementById('message-input')?.focus()
    })
  }

  if (!onboarded) {
    return (
      <div className="h-full">
        <WelcomeScreen />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onOpenSettings={() => {
          setSettingsOpen(true)
          setMobileOpen(false)
        }}
        onOpenAbout={() => {
          setAboutOpen(true)
          setMobileOpen(false)
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader onOpenMobile={() => setMobileOpen(true)} />
        {messages.length === 0 ? <EmptyState onPick={pickPrompt} /> : <MessageList dark={dark} />}
        <Composer draft={draft} onDraftChange={setDraft} />
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}
