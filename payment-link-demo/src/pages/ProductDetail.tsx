import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { iconFor } from '@/lib/icon-map'
import { LinkTicket } from '@/components/LinkTicket'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useProductsStore } from '@/store/products'
import { usePaymentLinksStore } from '@/store/payment-links'

export default function ProductDetail() {
  const { productId } = useParams()
  const product = useProductsStore((s) => (productId ? s.byId(productId) : undefined))
  // Subscribe to the stable `links` array, then derive — calling byProduct()
  // inside the selector returns a fresh array each render and loops zustand v5.
  const allLinks = usePaymentLinksStore((s) => s.links)
  const links = useMemo(
    () => (productId ? allLinks.filter((l) => l.productId === productId) : []),
    [allLinks, productId],
  )
  const latest = links[0]

  if (!product) {
    return (
      <div data-context="buyer" className="min-h-screen bg-background p-10 text-center text-muted-foreground">
        Product not found. <Link className="text-brand" to="/store">Back to shop</Link>
      </div>
    )
  }

  const Icon = iconFor(product.icon)

  return (
    <div data-context="buyer" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/store" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to shop
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-start gap-5">
          <div className="rounded-2xl border border-border bg-card p-6"><Icon className="h-12 w-12 text-brand" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold">{product.name}</h1>
            <p className="mt-1 text-muted-foreground">{product.blurb}</p>
            <div className="mt-2 font-mono text-2xl">{product.currency} {product.price}</div>
          </div>
        </div>

        <div className="mt-8">
          {latest ? (
            <LinkTicket
              title={product.name}
              amount={latest.amount}
              currency={latest.currency}
              payUrl={latest.payUrl}
              status={latest.status}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Not published yet — the merchant hasn't created a payment link for this item.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
