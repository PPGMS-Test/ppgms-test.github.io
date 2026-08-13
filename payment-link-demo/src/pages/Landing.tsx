import { Link } from 'react-router-dom'
import { Store, LayoutDashboard, ArrowRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-bold">paylink<span className="text-signal">.</span></span>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">PayPal Payment Links · Partner demo</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-16 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-8">
          <LayoutDashboard className="h-8 w-8 text-signal" />
          <h2 className="mt-4 font-display text-2xl font-bold">You create.</h2>
          <p className="mt-2 text-muted-foreground">
            As a partner, mint a payment link for any product on the merchant's behalf, then manage it.
          </p>
          <Link to="/merchant" className="mt-6 inline-flex items-center gap-2 font-medium text-signal">
            Open merchant console <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-2xl border border-border bg-card p-8">
          <Store className="h-8 w-8 text-verified" />
          <h2 className="mt-4 font-display text-2xl font-bold">They pay.</h2>
          <p className="mt-2 text-muted-foreground">
            Buyers browse the shop and check out through the hosted PayPal link — wallet, cards, Pay Later.
          </p>
          <Link to="/store" className="mt-6 inline-flex items-center gap-2 font-medium text-verified">
            Enter the shop <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  )
}
