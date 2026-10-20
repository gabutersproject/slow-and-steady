import { BookOpen, Code2, Lightbulb, GraduationCap, FileText } from 'lucide-react'
import type { ReactNode } from 'react'

import { useApp } from '../hooks/AppContext'

export const SUGGESTED_PROMPTS: { icon: ReactNode; label: string; prompt: string }[] = [
  { icon: <BookOpen className="size-4" />, label: 'Explain a complex topic simply.', prompt: 'Explain a complex topic simply: how does a transformer model actually work?' },
  { icon: <Code2 className="size-4" />, label: 'Help me write better code.', prompt: 'Help me write better code. Review this function and suggest clearer naming and error handling:\n\ndef fetch(url):\n    return requests.get(url).json()' },
  { icon: <FileText className="size-4" />, label: 'Summarize this text.', prompt: 'Summarize this text in three bullet points, then give a one-sentence takeaway:\n\nOpen-source language models can run on a laptop once they are quantized. Quantization stores weights in fewer bits so they fit in memory, with a small quality trade-off. That is why a 1.5B-parameter model can be useful without a GPU cluster.' },
  { icon: <Lightbulb className="size-4" />, label: 'Brainstorm a new project.', prompt: 'Brainstorm a new project I could build this weekend around local, privacy-focused software.' },
  { icon: <GraduationCap className="size-4" />, label: 'Teach me something new.', prompt: 'Teach me something new about how quantization lets language models run on a laptop.' },
]

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  const { status } = useApp()
  const demo = status?.provider === 'demo'

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 text-center animate-fade-in">
      <p className="text-muted text-xs font-medium tracking-widest uppercase">Slow and Steady</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Every great idea starts with a question.</h1>
      <p className="text-muted mt-3 max-w-md text-sm leading-relaxed">
        {demo
          ? 'You are in Demo Mode. Suggested prompts still work; replies are scripted until you connect a local model.'
          : 'Ask a question, paste something to summarise, or pick a prompt below. Nothing leaves this computer.'}
      </p>
      <ul className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((item) => (
          <li key={item.label} className={item.label.startsWith('Teach') ? 'sm:col-span-2 sm:justify-self-center sm:w-1/2' : ''}>
            <button
              type="button"
              onClick={() => onPick(item.prompt)}
              className="surface-raised flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors hover:border-moss-300 hover:bg-moss-50 dark:hover:border-moss-700 dark:hover:bg-moss-950/40"
            >
              <span className="mt-0.5 text-moss-600 dark:text-moss-300">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
