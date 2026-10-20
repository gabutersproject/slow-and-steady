import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../App'
import { SUGGESTED_PROMPTS } from '../components/EmptyState'
import { createMockBackend } from '../test/mockBackend'

function renderApp() {
  return render(<App />)
}

describe('Slow and Steady chat', () => {
  let backend: ReturnType<typeof createMockBackend>

  beforeEach(() => {
    window.localStorage.clear()
    backend = createMockBackend()
    vi.stubGlobal('fetch', backend.fetchImpl)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the first-launch welcome and enters demo mode', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(await screen.findByRole('heading', { name: /welcome to slow and steady/i })).toBeInTheDocument()
    expect(screen.getByText(/powered by open-source intelligence/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start demo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect local ai/i })).toBeInTheDocument()
    expect(screen.getByText(/ollama is not running/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start demo/i }))

    expect(await screen.findByText(/every great idea starts with a question/i)).toBeInTheDocument()
    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
    for (const prompt of SUGGESTED_PROMPTS) {
      expect(screen.getByRole('button', { name: prompt.label })).toBeInTheDocument()
    }
  })

  it('sends a prompt, streams the reply, and keeps demo replies labelled', async () => {
    window.localStorage.setItem('sas:onboarded', 'true')
    const user = userEvent.setup()
    renderApp()

    const input = await screen.findByPlaceholderText(/ask anything/i)
    await user.type(input, 'hello there')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/hello from demo/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/scripted, not an ai model/i)).toBeInTheDocument()
    expect(screen.queryByText('Local AI Ready')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /copy message/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /regenerate response/i })).toBeInTheDocument()
  })

  it('supports shift-enter for a newline and enter to send', async () => {
    window.localStorage.setItem('sas:onboarded', 'true')
    const user = userEvent.setup()
    renderApp()

    const input = await screen.findByPlaceholderText(/ask anything/i)
    await user.type(input, 'line one{Shift>}{Enter}{/Shift}line two')
    expect(input).toHaveValue('line one\nline two')
    await user.type(input, '{Enter}')
    await waitFor(() => expect(screen.getByText(/hello from demo/i)).toBeInTheDocument())
  })

  it('fills the composer from a suggested prompt', async () => {
    window.localStorage.setItem('sas:onboarded', 'true')
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: /explain a complex topic simply/i }))
    const input = screen.getByPlaceholderText(/ask anything/i)
    expect(input).toHaveValue(SUGGESTED_PROMPTS[0].prompt)
  })

  it('creates history entries and can start a new chat', async () => {
    window.localStorage.setItem('sas:onboarded', 'true')
    const user = userEvent.setup()
    renderApp()

    const input = await screen.findByPlaceholderText(/ask anything/i)
    await user.type(input, 'planning a garden{Enter}')
    await waitFor(() => expect(screen.getByText(/hello from demo/i)).toBeInTheDocument())

    const history = screen.getByRole('list', { name: /chat history/i })
    expect(within(history).getByRole('button', { name: 'planning a garden' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^new chat$/i }))
    expect(await screen.findByText(/every great idea starts with a question/i)).toBeInTheDocument()
  })

  it('never shows Local AI Ready when Ollama is offline', async () => {
    window.localStorage.setItem('sas:onboarded', 'true')
    renderApp()
    expect(await screen.findByText('Demo Mode')).toBeInTheDocument()
    expect(screen.queryByText('Local AI Ready')).not.toBeInTheDocument()
  })

  it('shows Local AI Ready only after the backend verifies Ollama and a model', async () => {
    backend.state.settings.provider = 'ollama'
    backend.state.settings.model = 'qwen2.5:1.5b'
    backend.state.ollamaAvailable = true
    backend.state.models = ['qwen2.5:1.5b']
    window.localStorage.setItem('sas:onboarded', 'true')
    renderApp()
    expect(await screen.findByText('Local AI Ready')).toBeInTheDocument()
  })

  it('clears the composer with the clear button', async () => {
    window.localStorage.setItem('sas:onboarded', 'true')
    const user = userEvent.setup()
    renderApp()
    const input = await screen.findByPlaceholderText(/ask anything/i)
    await user.type(input, 'draft text')
    await user.click(screen.getByRole('button', { name: /clear input/i }))
    expect(input).toHaveValue('')
  })
})
