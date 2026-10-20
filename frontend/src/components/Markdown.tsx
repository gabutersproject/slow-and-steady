import { Check, Copy } from 'lucide-react'
import { memo, useState, type ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'

import { copyToClipboard } from '../services/clipboard'

interface MarkdownProps {
  content: string
  dark: boolean
}

/**
 * Renders assistant output as GitHub-flavoured Markdown. Raw HTML is never
 * rendered (react-markdown escapes it by default), and links open in a new tab
 * without a referrer.
 */
export const Markdown = memo(function Markdown({ content, dark }: MarkdownProps) {
  return (
    <div className="prose-chat text-[15px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
          pre: ({ children }) => <>{children}</>,
          code: (props) => <CodeBlock {...props} dark={dark} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

type CodeProps = ComponentProps<'code'> & { dark: boolean; node?: unknown }

function CodeBlock({ className, children, dark, node: _node, ...rest }: CodeProps) {
  const match = /language-([\w-]+)/.exec(className ?? '')
  const code = String(children ?? '').replace(/\n$/, '')
  const isBlock = Boolean(match) || code.includes('\n')

  if (!isBlock) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    )
  }

  const language = match?.[1] ?? 'text'
  return (
    <div className="group/code my-2 overflow-hidden rounded-xl border text-[13px]">
      <div className="flex items-center justify-between border-b bg-[var(--surface-sunken)] px-3 py-1.5">
        <span className="text-muted font-mono text-[11px] tracking-wide uppercase">{language}</span>
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        language={language}
        style={dark ? oneDark : oneLight}
        customStyle={{ margin: 0, borderRadius: 0, background: 'transparent', padding: '0.85rem 0.9rem', fontSize: '13px' }}
        codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
        PreTag="div"
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export function CopyButton({ text, label = 'Copy code' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    const ok = await copyToClipboard(text)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className="text-muted inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] hover:bg-[var(--surface)] hover:text-[var(--text)]"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
