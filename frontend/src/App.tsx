import { ChatPage } from './pages/ChatPage'
import { AppProvider } from './hooks/AppContext'
import { Toasts } from './components/ui/Toasts'
import { useApp } from './hooks/AppContext'

function AppShell() {
  const { toasts, dismissToast } = useApp()
  return (
    <>
      <ChatPage />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
