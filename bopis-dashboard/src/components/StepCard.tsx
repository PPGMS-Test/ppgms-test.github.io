import { Loader2 } from 'lucide-react'
import type { StepResult } from '@/types'
import { StatusBadge } from './StatusBadge'
import { JsonBlock } from './JsonBlock'

interface Props {
  number: number
  title: string
  description: string
  requestBody?: unknown
  result: StepResult
  onExecute?: () => Promise<void>
  disabled?: boolean
  children?: React.ReactNode
}

export function StepCard({
  number,
  title,
  description,
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
        </div>
        <StatusBadge status={result.status} />
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>

      {requestBody !== undefined && (
        <JsonBlock label="Request Body" data={requestBody} defaultOpen={false} />
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
