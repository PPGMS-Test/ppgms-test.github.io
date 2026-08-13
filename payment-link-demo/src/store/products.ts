/**
 * 产品 store：内置若干种子产品，商户与买家两侧共用。
 * icon 为 lucide-react 图标名（在组件里映射）。
 */
import { create } from 'zustand'

export interface Product {
  id: string
  name: string
  description: string
  /** 金额字符串，PLB amount.value */
  price: string
  currency: string
  /** lucide 图标名 */
  icon: string
  blurb: string
}

const SEED_PRODUCTS: Product[] = [
  { id: 'tote', name: 'Canvas Tote', description: 'Heavyweight organic-cotton tote.', price: '160.00', currency: 'USD', icon: 'shopping-bag', blurb: 'Carry everything, look good doing it.' },
  { id: 'watch', name: 'Field Watch', description: 'Sapphire crystal, 200m water resist.', price: '420.00', currency: 'USD', icon: 'watch', blurb: 'A quiet instrument for loud days.' },
  { id: 'mug', name: 'Enamel Mug', description: '12oz speckled enamel camp mug.', price: '18.00', currency: 'USD', icon: 'coffee', blurb: 'Trail coffee, tastes better.' },
  { id: 'lamp', name: 'Desk Lamp', description: 'Warm dimmable LED, brass arm.', price: '95.00', currency: 'USD', icon: 'lamp', blurb: 'Light that means business.' },
]

interface ProductsState {
  products: Product[]
  byId: (id: string) => Product | undefined
}

export const useProductsStore = create<ProductsState>((_set, get) => ({
  products: SEED_PRODUCTS,
  byId: (id) => get().products.find((p) => p.id === id),
}))
