import { iconFor } from '@/lib/icon-map'
import type { Product } from '@/store/products'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  action?: React.ReactNode
  className?: string
}

export function ProductCard({ product, action, className }: ProductCardProps) {
  const Icon = iconFor(product.icon)
  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground', className)}>
      <Icon className="h-7 w-7 text-brand" />
      <div className="mt-3 font-display text-lg font-semibold">{product.name}</div>
      <div className="mt-1 text-sm text-muted-foreground">{product.description}</div>
      <div className="mt-3 font-mono text-xl">{product.currency} {product.price}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
