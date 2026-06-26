import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  label: string
  data: unknown
  defaultOpen?: boolean
}

export function JsonBlock({ label, data, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  if (data === undefined) return null

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
        <pre className="mt-1 p-3 bg-slate-900 text-slate-100 rounded-md overflow-auto min-h-[4rem] max-h-64 resize-y text-[11px] leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
