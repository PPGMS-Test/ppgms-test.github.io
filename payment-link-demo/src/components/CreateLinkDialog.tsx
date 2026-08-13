import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCredentialsStore } from '@/store/credentials'
import { usePaymentLinksStore } from '@/store/payment-links'
import type { Product } from '@/store/products'
import { extractPayUrl, ApiError } from '@/lib/api/types'

interface Props {
  product: Product | null
  onClose: () => void
}

export function CreateLinkDialog({ product, onClose }: Props) {
  const { client } = useCredentialsStore()
  const addLink = usePaymentLinksStore((s) => s.add)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!product) return
    setLoading(true)
    setError(null)
    try {
      const value = amount || product.price
      const res = await client.createLink({
        name: product.name,
        description: product.description,
        amount: { currency_code: product.currency, value },
      })
      const payUrl = extractPayUrl(res)
      if (!payUrl) throw new Error('Link created but no pay URL was returned.')
      addLink({
        id: crypto.randomUUID(),
        productId: product.id,
        resourceId: res.id,
        payUrl,
        status: 'live',
        amount: value,
        currency: product.currency,
        createdAt: Date.now(),
        raw: res,
      })
      onClose()
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.message} (HTTP ${e.status})` : (e as Error).message
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()} title={`Create link · ${product?.name ?? ''}`}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="amt">Amount ({product?.currency})</Label>
          <Input id="amt" value={amount} placeholder={product?.price} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button className="w-full" loading={loading} onClick={submit}>Create link</Button>
      </div>
    </Dialog>
  )
}
