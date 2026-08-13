import { ShoppingBag, Watch, Coffee, Lamp, Package, type LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  'shopping-bag': ShoppingBag,
  watch: Watch,
  coffee: Coffee,
  lamp: Lamp,
}

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Package
}
