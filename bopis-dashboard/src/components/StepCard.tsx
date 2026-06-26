import { Loader2 } from 'lucide-react'
import type { StepResult } from '@/types'
import { StatusBadge } from './StatusBadge'
import { JsonBlock } from './JsonBlock'

interface Props {
  number: number
  title: string
  badge?: { label: string; variant: 'green' | 'amber' | 'blue' | 'slate' }
  description: string
  requestUrl?: string
  requestBody?: unknown
  result: StepResult
  onExecute?: () => Promise<void>
  disabled?: boolean
  children?: React.ReactNode
}

const BADGE_STYLES = {
  green: 'bg-green-100 text-green-700 border-green-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  blue:  'bg-blue-100 text-blue-700 border-blue-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function StepCard({
  number,
  title,
  badge,
  description,
  requestUrl,
  requestBody,
  result,
  onExecute,
  disabled,
  children,
}: Props) {
  const isLoading = result.status === 'loading'
  const canExecute = !disabled && !isLoading && onExecute !== undefined

  return (
    <div
      className={`rounded-lg border bg-card p-4 space-y-3 transition-opacity ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {number}
          </span>
          <h3 className="font-semibold text-sm">{title}</h3>
          {badge && (
            <span className={`border rounded px-1.5 py-0.5 text-xs font-medium ${BADGE_STYLES[badge.variant]}`}>
              {badge.label}
            </span>
          )}
        </div>
        <StatusBadge status={result.status} />
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>

      {requestUrl !== undefined && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Request</p>
          <code className="block text-xs font-mono bg-muted px-2 py-1.5 rounded break-all leading-relaxed">
            {requestUrl}
          </code>
        </div>
      )}
      {requestBody !== undefined && (
        <JsonBlock label="Body" data={requestBody} defaultOpen={false} />
      )}

      {onExecute && (
        <button
          onClick={() => void onExecute()}
          disabled={!canExecute}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          执行
        </button>
      )}

      {children}

      {result.response !== undefined && (
        <JsonBlock label="Response" data={result.response} defaultOpen={true} />
      )}

      {result.error && (
        <p className="text-xs text-red-600 font-mono">{result.error}</p>
      )}
    </div>
  )
}
