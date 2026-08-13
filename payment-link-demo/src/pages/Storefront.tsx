import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ProductCard } from '@/components/ProductCard'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useProductsStore } from '@/store/products'
import { usePaymentLinksStore } from '@/store/payment-links'

export default function Storefront() {
  const products = useProductsStore((s) => s.products)
  const byProduct = usePaymentLinksStore((s) => s.byProduct)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> paylink
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-display font-semibold">The Shop</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const hasLink = byProduct(p.id).length > 0
            return (
              <ProductCard
                key={p.id}
                product={p}
                action={
                  <Link to={`/store/${p.id}`}>
                    <Button size="sm" variant={hasLink ? 'default' : 'outline'} className="w-full">
                      {hasLink ? 'View & pay' : 'View'}
                    </Button>
                  </Link>
                }
              />
            )
          })}
        </div>
      </main>
    </div>
  )
}
