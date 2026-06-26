import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react'
import type { StepStatus } from '@/types'

interface Props { status: StepStatus }

export function StatusBadge({ status }: Props) {
  if (status === 'idle')
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Circle className="h-3 w-3" />待执行</span>
  if (status === 'loading')
    return <span className="flex items-center gap-1 text-xs text-blue-600"><Loader2 className="h-3 w-3 animate-spin" />执行中</span>
  if (status === 'success')
    return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" />成功</span>
  return <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="h-3 w-3" />失败</span>
}
