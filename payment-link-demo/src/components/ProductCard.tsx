import { useEffect, useState } from 'react'
import { iconFor } from '@/lib/icon-map'
import type { Product } from '@/store/products'
import { cn } from '@/lib/utils'
import { generateDefaultProductImage } from '@/lib/images'

interface ProductCardProps {
  product: Product
  action?: React.ReactNode
  className?: string
}

export function ProductCard({ product, action, className }: ProductCardProps) {
  const Icon = iconFor(product.icon)
  // 生成与创建 link 时相同的默认商品图预览（canvas，异步）
  const [thumb, setThumb] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    generateDefaultProductImage(product)
      .then(({ dataUrl }) => {
        if (!cancelled) setThumb(dataUrl)
      })
      .catch(() => {
        /* 生成失败时回退到图标 */
      })
    return () => {
      cancelled = true
    }
  }, [product.id])

  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground', className)}>
      <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-muted">
        {thumb ? (
          <img src={thumb} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className="h-7 w-7 text-brand" />
          </div>
        )}
      </div>
      <div className="font-display text-lg font-semibold">{product.name}</div>
      <div className="mt-1 text-sm text-muted-foreground">{product.description}</div>
      <div className="mt-3 font-mono text-xl">{product.currency} {product.price}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
