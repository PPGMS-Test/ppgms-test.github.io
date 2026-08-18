/**
 * LineItemForm：单个 line item 的全量可视化表单（受控组件，父级持有 state）。
 *
 * 覆盖 PLB line item 文档里的全部字段：
 *   基础信息 / 收货地址 / 税 / 运费 / 折扣 / 手续费 / 买家备注 / 可调数量 / 变体维度。
 *
 * 设计约定：
 *   - 每个可选区块（税/运费/…）用一个开关控制；关闭时对应字段 emit 成 undefined，
 *     绝不 emit 空数组或只含空串的对象，保持上送 body 干净。
 *   - name 与 unit_amount 恒定 emit。
 *   - 变体：最多 3 维度，每维度最多 10 选项；同一时刻只有一个主维度(primary)，
 *     主维度的 option 才带单价。0 维度时 variants=undefined。
 */
import {
  Package,
  Percent,
  Truck,
  Tag,
  Wallet,
  MessageSquare,
  Hash,
  Layers,
  Plus,
  Trash2,
  Image as ImageIcon,
  Star,
} from 'lucide-react'
import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useFeatureFlagsStore } from '@/store/feature-flags'
import {
  MAX_IMAGES_PER_ITEM,
  ACCEPTED_IMAGE_TYPES,
  filesToFormImages,
  type FormImage,
} from '@/lib/images'
import type {
  LineItem,
  AmountType,
  Tax,
  Shipping,
  Discount,
  Handling,
  CustomerNote,
  VariantDimension,
  VariantOption,
} from '@/lib/api/types'

interface Props {
  value: LineItem
  onChange: (next: LineItem) => void
  currency: string
  /** 图片作为独立 UI 状态（含未上传 File / 预览），由父级持有并在提交时上传 */
  images: FormImage[]
  onImagesChange: (next: FormImage[]) => void
}

const MAX_DIMENSIONS = 3
const MAX_OPTIONS = 10

// ── 小工具组件 ────────────────────────────────────────────────────────────────

/** 区块外壳：圆角边框卡片 + 图标标题行 */
function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-brand">{icon}</span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      {children}
    </div>
  )
}

/** 原生 checkbox 开关（无 Checkbox 原语，用样式化原生 input） */
function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-border accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

/** 金额输入：右侧固定展示币种，值为 unit_amount.value */
function AmountInput({
  value,
  currency,
  onChange,
  placeholder,
}: {
  value: string
  currency: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        inputMode="decimal"
        value={value}
        placeholder={placeholder ?? '0.00'}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="text-sm text-muted-foreground">{currency}</span>
    </div>
  )
}

const AMOUNT_TYPE_OPTIONS: AmountType[] = ['FLAT', 'PERCENTAGE']

/** AmountType 下拉（FLAT / PERCENTAGE） */
function AmountTypeSelect({
  value,
  onChange,
}: {
  value: AmountType
  onChange: (v: AmountType) => void
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as AmountType)}>
      {AMOUNT_TYPE_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </Select>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export function LineItemForm({ value, onChange, currency, images, onImagesChange }: Props) {
  // 统一入口：局部 patch 合并到 value 后 emit
  const patch = (p: Partial<LineItem>) => onChange({ ...value, ...p })

  const imagesEnabled = useFeatureFlagsStore((s) => s.imagesEnabled)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tax = value.taxes?.[0]
  const shipping = value.shipping?.[0]
  const discount = value.discounts?.[0]
  const handling = value.handling?.[0]
  const note = value.customer_notes?.[0]
  const adjustable = value.adjustable_quantity
  const dimensions = value.variants?.dimensions ?? []

  // ── 变体维度操作 ────────────────────────────────────────────────────────────
  function setDimensions(next: VariantDimension[]) {
    patch({ variants: next.length ? { dimensions: next } : undefined })
  }
  function addDimension() {
    if (dimensions.length >= MAX_DIMENSIONS) return
    // 若已存在维度则新维度默认非主；无任何维度时首个设为主
    const isFirst = dimensions.length === 0
    setDimensions([...dimensions, { name: '', primary: isFirst, options: [{ label: '' }] }])
  }
  function removeDimension(idx: number) {
    setDimensions(dimensions.filter((_, i) => i !== idx))
  }
  function updateDimension(idx: number, p: Partial<VariantDimension>) {
    setDimensions(dimensions.map((d, i) => (i === idx ? { ...d, ...p } : d)))
  }
  function setPrimary(idx: number) {
    // 单选：设某维度为主时清掉其它维度的 primary，并去掉它们 option 上的价格
    setDimensions(
      dimensions.map((d, i) => {
        if (i === idx) return { ...d, primary: true }
        return {
          ...d,
          primary: false,
          options: d.options.map(({ label }) => ({ label })),
        }
      }),
    )
  }
  function addOption(dimIdx: number) {
    const d = dimensions[dimIdx]
    if (d.options.length >= MAX_OPTIONS) return
    updateDimension(dimIdx, { options: [...d.options, { label: '' }] })
  }
  function removeOption(dimIdx: number, optIdx: number) {
    const d = dimensions[dimIdx]
    updateDimension(dimIdx, { options: d.options.filter((_, i) => i !== optIdx) })
  }
  function updateOption(dimIdx: number, optIdx: number, p: Partial<VariantOption>) {
    const d = dimensions[dimIdx]
    updateDimension(dimIdx, {
      options: d.options.map((o, i) => (i === optIdx ? { ...o, ...p } : o)),
    })
  }

  // ── 图片操作 ────────────────────────────────────────────────────────────────
  function addImageFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const remaining = MAX_IMAGES_PER_ITEM - images.length
    if (remaining <= 0) return
    const picked = Array.from(fileList).slice(0, remaining)
    // 当前没有任何图片时，新加入的首张自动设为主图
    onImagesChange([...images, ...filesToFormImages(picked, images.length === 0)])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  function removeImage(key: string) {
    let next = images.filter((i) => i.key !== key)
    // 删掉的若是主图且仍有剩余，则把第一张补为主图（保证有且仅有一张主图）
    if (next.length > 0 && !next.some((i) => i.is_primary)) {
      next = next.map((i, idx) => ({ ...i, is_primary: idx === 0 }))
    }
    onImagesChange(next)
  }
  function setPrimaryImage(key: string) {
    onImagesChange(images.map((i) => ({ ...i, is_primary: i.key === key })))
  }

  return (
    <div className="space-y-4">
      {/* ── 1. 基础信息 ───────────────────────────────────────────────── */}
      <Section icon={<Package className="h-4 w-4" />} label="Basics">
        <div className="space-y-3">
          <div>
            <Label htmlFor="li-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="li-name"
              value={value.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Product name"
            />
          </div>
          <div>
            <Label htmlFor="li-sku">SKU (optional)</Label>
            <Input
              id="li-sku"
              value={value.product_id ?? ''}
              onChange={(e) => patch({ product_id: e.target.value || undefined })}
              placeholder="product_id"
            />
          </div>
          <div>
            <Label htmlFor="li-desc">Description</Label>
            <textarea
              id="li-desc"
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={value.description ?? ''}
              onChange={(e) => patch({ description: e.target.value || undefined })}
              placeholder="Describe the item"
            />
          </div>
          <div>
            <Label htmlFor="li-amt">Unit amount</Label>
            <AmountInput
              value={value.unit_amount.value}
              currency={currency}
              onChange={(v) => patch({ unit_amount: { currency_code: currency, value: v } })}
            />
          </div>
        </div>
      </Section>

      {/* ── 1b. 图片（两步上传：先上传拿 asset_id，再随 line item 引用）；受全局开关门控 ── */}
      {imagesEnabled && (
        <Section icon={<ImageIcon className="h-4 w-4" />} label="Images">
        <p className="mb-3 text-xs text-muted-foreground">
          Up to {MAX_IMAGES_PER_ITEM} images · PNG / JPEG / BMP · exactly one primary. Uploaded on
          submit (2-step: <span className="font-mono">POST /images</span> → asset_id →{' '}
          <span className="font-mono">line_items[].images[]</span>).
        </p>

        {images.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img) => (
              <div key={img.key} className="rounded-lg border border-border p-2">
                <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  {img.previewUrl ? (
                    <img
                      src={img.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                      <span className="px-1 text-center font-mono text-[10px] break-all">
                        {img.asset_id ?? 'asset'}
                      </span>
                    </div>
                  )}
                  {img.is_primary && (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-white">
                      <Star className="h-3 w-3" /> Primary
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1">
                  {img.asset_id ? (
                    <div className="font-mono text-[10px] text-muted-foreground break-all">
                      {img.asset_id}
                      {img.status ? ` · ${img.status}` : ''}
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground">Pending upload</div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-1 text-xs text-foreground">
                      <input
                        type="radio"
                        name="li-primary-image"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={img.is_primary}
                        onChange={() => setPrimaryImage(img.key)}
                      />
                      Primary
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeImage(img.key)}
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          className="hidden"
          onChange={(e) => addImageFiles(e.target.files)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={images.length >= MAX_IMAGES_PER_ITEM}
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="h-4 w-4" /> Add image
        </Button>
        </Section>
      )}

      {/* ── 2. 收货地址 ───────────────────────────────────────────────── */}
      <Section icon={<Truck className="h-4 w-4" />} label="Shipping address">
        <Toggle
          id="li-collect-addr"
          checked={!!value.collect_shipping_address}
          onChange={(c) => patch({ collect_shipping_address: c || undefined })}
          label="Collect shipping address at checkout"
        />
      </Section>

      {/* ── 3. 税 ─────────────────────────────────────────────────────── */}
      <Section icon={<Percent className="h-4 w-4" />} label="Tax">
        <Toggle
          id="li-tax-toggle"
          checked={!!tax}
          onChange={(c) => patch({ taxes: c ? [{ type: 'FLAT', value: '' }] : undefined })}
          label="Add tax"
        />
        {tax && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="li-tax-name">Name (optional)</Label>
              <Input
                id="li-tax-name"
                value={tax.name ?? ''}
                onChange={(e) =>
                  patch({ taxes: [{ ...tax, name: e.target.value || undefined } as Tax] })
                }
                placeholder="Sales tax"
              />
            </div>
            <div>
              <Label htmlFor="li-tax-type">Type</Label>
              <AmountTypeSelect
                value={tax.type}
                onChange={(t) => patch({ taxes: [{ ...tax, type: t }] })}
              />
            </div>
            <div>
              <Label htmlFor="li-tax-val">Value</Label>
              <Input
                id="li-tax-val"
                inputMode="decimal"
                value={tax.value}
                onChange={(e) => patch({ taxes: [{ ...tax, value: e.target.value }] })}
                placeholder={tax.type === 'PERCENTAGE' ? '10' : '0.00'}
              />
            </div>
          </div>
        )}
      </Section>

      {/* ── 4. 运费 ───────────────────────────────────────────────────── */}
      <Section icon={<Truck className="h-4 w-4" />} label="Shipping">
        <Toggle
          id="li-ship-toggle"
          checked={!!shipping}
          onChange={(c) => patch({ shipping: c ? [{ type: 'FLAT', value: '' }] : undefined })}
          label="Add shipping"
        />
        {shipping && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="li-ship-type">Type</Label>
              <AmountTypeSelect
                value={shipping.type}
                onChange={(t) => patch({ shipping: [{ ...shipping, type: t }] })}
              />
            </div>
            <div>
              <Label htmlFor="li-ship-val">Value</Label>
              <Input
                id="li-ship-val"
                inputMode="decimal"
                value={shipping.value}
                onChange={(e) => patch({ shipping: [{ ...shipping, value: e.target.value }] })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="li-ship-add">Additional unit (optional)</Label>
              <Input
                id="li-ship-add"
                inputMode="decimal"
                value={shipping.additional_unit_value ?? ''}
                onChange={(e) =>
                  patch({
                    shipping: [
                      { ...shipping, additional_unit_value: e.target.value || undefined } as Shipping,
                    ],
                  })
                }
                placeholder="Per extra item"
              />
            </div>
          </div>
        )}
      </Section>

      {/* ── 5. 折扣 ───────────────────────────────────────────────────── */}
      <Section icon={<Tag className="h-4 w-4" />} label="Discount">
        <Toggle
          id="li-disc-toggle"
          checked={!!discount}
          onChange={(c) => patch({ discounts: c ? [{ type: 'FLAT', value: '' }] : undefined })}
          label="Add discount"
        />
        {discount && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="li-disc-type">Type</Label>
              <AmountTypeSelect
                value={discount.type}
                onChange={(t) => patch({ discounts: [{ ...discount, type: t } as Discount] })}
              />
            </div>
            <div>
              <Label htmlFor="li-disc-val">Value</Label>
              <Input
                id="li-disc-val"
                inputMode="decimal"
                value={discount.value}
                onChange={(e) => patch({ discounts: [{ ...discount, value: e.target.value }] })}
                placeholder="0.00"
              />
            </div>
          </div>
        )}
      </Section>

      {/* ── 6. 手续费 ─────────────────────────────────────────────────── */}
      <Section icon={<Wallet className="h-4 w-4" />} label="Handling">
        <Toggle
          id="li-handling-toggle"
          checked={!!handling}
          onChange={(c) => patch({ handling: c ? [{ type: 'FLAT', value: '' }] : undefined })}
          label="Add handling"
        />
        {handling && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="li-handling-type">Type</Label>
              <AmountTypeSelect
                value={handling.type}
                onChange={(t) => patch({ handling: [{ ...handling, type: t } as Handling] })}
              />
            </div>
            <div>
              <Label htmlFor="li-handling-val">Value</Label>
              <Input
                id="li-handling-val"
                inputMode="decimal"
                value={handling.value}
                onChange={(e) => patch({ handling: [{ ...handling, value: e.target.value }] })}
                placeholder="0.00"
              />
            </div>
          </div>
        )}
      </Section>

      {/* ── 7. 买家备注 ───────────────────────────────────────────────── */}
      <Section icon={<MessageSquare className="h-4 w-4" />} label="Customer note">
        <Toggle
          id="li-note-toggle"
          checked={!!note}
          onChange={(c) =>
            patch({ customer_notes: c ? [{ label: '', required: false }] : undefined })
          }
          label="Ask buyer for a note"
        />
        {note && (
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="li-note-label">Label</Label>
              <Input
                id="li-note-label"
                value={note.label}
                onChange={(e) =>
                  patch({ customer_notes: [{ ...note, label: e.target.value } as CustomerNote] })
                }
                placeholder="Gift message"
              />
            </div>
            <Toggle
              id="li-note-required"
              checked={note.required}
              onChange={(c) => patch({ customer_notes: [{ ...note, required: c }] })}
              label="Required"
            />
          </div>
        )}
      </Section>

      {/* ── 8. 可调数量 ───────────────────────────────────────────────── */}
      <Section icon={<Hash className="h-4 w-4" />} label="Adjustable quantity">
        <Toggle
          id="li-qty-toggle"
          checked={!!adjustable}
          onChange={(c) => patch({ adjustable_quantity: c ? {} : undefined })}
          label="Let buyer change quantity"
        />
        {adjustable && (
          <div className="mt-3 max-w-xs">
            <Label htmlFor="li-qty-max">Maximum</Label>
            <Input
              id="li-qty-max"
              inputMode="numeric"
              value={adjustable.maximum != null ? String(adjustable.maximum) : ''}
              onChange={(e) => {
                const n = e.target.value.trim()
                patch({
                  adjustable_quantity: {
                    ...adjustable,
                    maximum: n === '' ? undefined : Number(n),
                  },
                })
              }}
              placeholder="e.g. 10"
            />
          </div>
        )}
      </Section>

      {/* ── 9. 变体维度 ───────────────────────────────────────────────── */}
      <Section icon={<Layers className="h-4 w-4" />} label="Variants">
        <div className="space-y-3">
          {dimensions.map((dim, dimIdx) => (
            <div key={dimIdx} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={dim.name}
                  onChange={(e) => updateDimension(dimIdx, { name: e.target.value })}
                  placeholder={`Dimension ${dimIdx + 1} (e.g. Size)`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDimension(dimIdx)}
                  aria-label="Remove dimension"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="li-primary-dim"
                  className="h-4 w-4 accent-primary"
                  checked={dim.primary}
                  onChange={() => setPrimary(dimIdx)}
                />
                Primary dimension (options carry price)
              </label>

              <div className="mt-3 space-y-2">
                {dim.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <Input
                      value={opt.label}
                      onChange={(e) => updateOption(dimIdx, optIdx, { label: e.target.value })}
                      placeholder={`Option ${optIdx + 1}`}
                    />
                    {dim.primary && (
                      <div className="flex items-center gap-1">
                        <Input
                          inputMode="decimal"
                          className="w-28"
                          value={opt.unit_amount?.value ?? ''}
                          onChange={(e) =>
                            updateOption(dimIdx, optIdx, {
                              unit_amount: e.target.value
                                ? { currency_code: currency, value: e.target.value }
                                : undefined,
                            })
                          }
                          placeholder="0.00"
                        />
                        <span className="text-xs text-muted-foreground">{currency}</span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(dimIdx, optIdx)}
                      aria-label="Remove option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {dim.options.length < MAX_OPTIONS && (
                  <Button variant="outline" size="sm" onClick={() => addOption(dimIdx)}>
                    <Plus className="h-4 w-4" /> Add option
                  </Button>
                )}
              </div>
            </div>
          ))}

          {dimensions.length < MAX_DIMENSIONS && (
            <Button variant="outline" size="sm" onClick={addDimension}>
              <Plus className="h-4 w-4" /> Add dimension
            </Button>
          )}
        </div>
      </Section>
    </div>
  )
}
