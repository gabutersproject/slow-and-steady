import { LogoMark } from './Logo'
import { Dialog } from './ui/Dialog'

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="About Slow and Steady" size="md">
      <div className="space-y-4 text-sm leading-relaxed">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="font-semibold">Slow and Steady</p>
            <p className="text-muted">Build Something with Open-Source AI at Its Core.</p>
          </div>
        </div>
        <p>
          A personal AI workspace that talks to open-source models running on your own computer. Conversations are stored
          in a local SQLite file. There is no account, no telemetry, and no cloud language-model provider.
        </p>
        <div>
          <h3 className="font-semibold">What may use the network</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--text)]">
            <li>Installing npm or Python packages, the first time you set the project up.</li>
            <li>
              Downloading a model with the Ollama CLI, for example <code className="font-mono text-[12px]">ollama pull qwen2.5:1.5b</code>.
            </li>
            <li>Opening documentation links from this dialog, if you choose to click them.</li>
          </ul>
        </div>
        <p className="text-muted">
          After those steps, chat traffic stays on localhost between this interface, the FastAPI backend, and (when you
          connect it) Ollama. The application is not “completely offline” until those dependencies and a model are
          installed and you have verified that generation works without a network.
        </p>
        <p>
          Documentation lives in the repository README. Source and issues are yours to keep — this is local-first software.
        </p>
      </div>
    </Dialog>
  )
}
