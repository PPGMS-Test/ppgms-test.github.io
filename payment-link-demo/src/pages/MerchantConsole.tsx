import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/ProductCard'
import { CreateLinkDialog } from '@/components/CreateLinkDialog'
import { LinksList } from '@/components/LinksList'
import { CredentialsPanel } from '@/components/CredentialsPanel'
import { EnvBadge } from '@/components/EnvBadge'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useProductsStore, type Product } from '@/store/products'

export default function MerchantConsole() {
  const products = useProductsStore((s) => s.products)
  const [active, setActive] = useState<Product | null>(null)

  return (
    <div data-context="merchant" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> paylink
          </Link>
          <div className="flex items-center gap-3">
            <EnvBadge />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[1fr,320px]">
        <div className="space-y-8">
          <section>
            <h2 className="font-display text-xl font-bold">Products</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  action={<Button size="sm" className="w-full" onClick={() => setActive(p)}>Create link</Button>}
                />
              ))}
            </div>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Links</h2>
            <div className="mt-4"><LinksList /></div>
          </section>
        </div>
        <aside className="lg:sticky lg:top-8 lg:self-start"><CredentialsPanel /></aside>
      </main>

      <CreateLinkDialog product={active} onClose={() => setActive(null)} />
    </div>
  )
}
