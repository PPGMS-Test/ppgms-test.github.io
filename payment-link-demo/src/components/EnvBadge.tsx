import { useCredentialsStore } from '@/store/credentials'
import { cn } from '@/lib/utils'

/** 顶栏环境 + 集成角色 + 凭证身份 chip */
export function EnvBadge({ className }: { className?: string }) {
  const { credential, mode } = useCredentialsStore()
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-mono', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-verified" />
      {credential.environment} · {mode === 'third-party' ? '3rd' : '1st'} · {credential.label}
    </span>
  )
}
