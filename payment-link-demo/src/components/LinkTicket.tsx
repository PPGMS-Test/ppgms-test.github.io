import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LinkStatus } from '@/store/payment-links'

interface LinkTicketProps {
  title: string
  amount: string
  currency: string
  payUrl: string
  status: LinkStatus
  /** 深色（merchant）或浅色（buyer）语境 */
  tone?: 'dark' | 'light'
  className?: string
  children?: React.ReactNode
}

const statusStyles: Record<LinkStatus, string> = {
  live: 'bg-verified/15 text-verified',
  paid: 'bg-signal/15 text-signal',
  expired: 'bg-muted text-muted-foreground',
}

export function LinkTicket({ title, amount, currency, payUrl, status, className, children }: LinkTicketProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(payUrl)
    setCopied(true)
    console.log('[LinkTicket] copied url:', payUrl)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground sm:flex-row',
        'transition-transform duration-200 hover:-translate-y-0.5',
        className,
      )}
    >
      {/* Left stub: product + amount */}
      <div className="flex-1 p-5">
        <div className="font-display text-lg font-semibold">{title}</div>
        <div className="mt-1 font-mono text-2xl">
          {currency} {amount}
        </div>
        <span className={cn('mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', statusStyles[status])}>
          {status}
        </span>
      </div>

      {/* Perforation divider */}
      <div className="relative shrink-0 sm:w-px sm:self-stretch">
        <div className="absolute inset-x-4 top-0 border-t border-dashed border-border sm:inset-x-0 sm:inset-y-4 sm:left-1/2 sm:top-0 sm:h-full sm:border-l sm:border-t-0" />
        {/* notch cut-outs */}
        <div className="absolute -left-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-background sm:block" />
        <div className="absolute -left-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-background sm:block" style={{ top: 0 }} />
      </div>

      {/* Right: live link chip + actions */}
      <div className="flex flex-col justify-center gap-3 p-5 sm:w-72">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
          <span className="truncate font-mono text-xs">{payUrl}</span>
          <button onClick={copy} aria-label="Copy link" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
            {copied ? <Check className="h-4 w-4 text-verified" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <a
          href={payUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          Open link <ExternalLink className="h-4 w-4" />
        </a>
        {children}
      </div>
    </div>
  )
}
