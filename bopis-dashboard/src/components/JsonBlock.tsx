import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface Props {
  label: string
  data: unknown
  defaultOpen?: boolean
}

export function JsonBlock({ label, data, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)
  if (data === undefined) return null

  const json = JSON.stringify(data, null, 2)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label}
      </button>
      {open && (
        <div className="mt-1">
          <div className="flex justify-end bg-slate-900 rounded-t-md px-2 py-1 border-b border-slate-700">
            <button
              onClick={handleCopy}
              title="复制 JSON"
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <pre className="json-scrollbar p-3 bg-slate-900 text-slate-100 rounded-b-md overflow-auto min-h-[4rem] h-64 resize-y text-[11px] leading-relaxed">
            {json}
          </pre>
        </div>
      )}
    </div>
  )
}
