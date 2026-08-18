/**
 * 产品 store：内置若干种子产品，商户与买家两侧共用。
 * icon 为 lucide-react 图标名（在组件里映射）。
 */
import { create } from 'zustand'

// 商品图放在 public/（Vite 静态目录，按 base 前缀访问）。这些是 SVG，仅用于前端展示；
// 作图片上传时会先光栅化成 PNG（上传接口只收 PNG/JPEG/BMP，见 lib/images.ts）。
const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

export interface Product {
  id: string
  name: string
  description: string
  /** 金额字符串，PLB amount.value */
  price: string
  currency: string
  /** lucide 图标名（图片加载失败时的回退） */
  icon: string
  /** 商品图 URL（public 下的 SVG），作卡片缩略图与默认商品图 */
  image: string
  blurb: string
}

const SEED_PRODUCTS: Product[] = [
  { id: 'tote', name: 'Canvas Tote', description: 'Heavyweight organic-cotton tote.', price: '160.00', currency: 'USD', icon: 'shopping-bag', image: asset('tote-bags.svg'), blurb: 'Carry everything, look good doing it.' },
  { id: 'watch', name: 'Field Watch', description: 'Sapphire crystal, 200m water resist.', price: '420.00', currency: 'USD', icon: 'watch', image: asset('Watch.svg'), blurb: 'A quiet instrument for loud days.' },
  { id: 'mug', name: 'Enamel Mug', description: '12oz speckled enamel camp mug.', price: '18.00', currency: 'USD', icon: 'coffee', image: asset('Tea-Mug.svg'), blurb: 'Trail coffee, tastes better.' },
  { id: 'lamp', name: 'Desk Lamp', description: 'Warm dimmable LED, brass arm.', price: '95.00', currency: 'USD', icon: 'lamp', image: asset('lamp.svg'), blurb: 'Light that means business.' },
]

interface ProductsState {
  products: Product[]
  byId: (id: string) => Product | undefined
}

export const useProductsStore = create<ProductsState>((_set, get) => ({
  products: SEED_PRODUCTS,
  byId: (id) => get().products.find((p) => p.id === id),
}))
