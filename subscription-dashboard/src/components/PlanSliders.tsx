// subscription-dashboard/src/components/PlanSliders.tsx
import { Card } from '@/components/ui/Card'
import { useFlowStore } from '@/store/flow'
import type { IntervalUnit, PlanType } from '@/lib/plan-config'

const PLAN_TYPES: { id: PlanType; label: string }[] = [
  { id: 'fixed', label: 'Fixed Price' },
  { id: 'trial', label: 'Trial' },
  { id: 'setupFee', label: 'Setup Fee' },
]

const INTERVAL_UNITS: IntervalUnit[] = ['DAY', 'WEEK', 'MONTH', 'YEAR']

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      <span className="flex justify-between text-ink">
        <span>{label}</span>
        <span className="font-mono">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[color:var(--accent)]"
      />
    </label>
  )
}

export function PlanSliders() {
  const planType = useFlowStore((s) => s.planType)
  const planConfig = useFlowStore((s) => s.planConfig)
  const setPlanType = useFlowStore((s) => s.setPlanType)
  const updatePlanConfig = useFlowStore((s) => s.updatePlanConfig)

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex gap-2">
        {PLAN_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setPlanType(t.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              planType === t.id ? 'bg-accent text-[color:var(--on-accent)]' : 'bg-surface2 text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">
        Tiered/Quantity Plan（基于用量或席位数的变动计费）涉及 <code>pricing_scheme.tiers</code>，复杂度高，仅在 Integration Guide
        中讲解概念，不提供交互滑块。
      </p>

      {planType === 'trial' && (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
          <p className="text-xs font-semibold text-ink">Trial 阶段</p>
          <label className="flex flex-col gap-1 text-xs text-muted">
            <span className="text-ink">interval unit</span>
            <select
              value={planConfig.trial.intervalUnit}
              onChange={(e) => updatePlanConfig({ trial: { ...planConfig.trial, intervalUnit: e.target.value as IntervalUnit } })}
              className="rounded border border-line bg-surface2 px-2 py-1 text-ink"
            >
              {INTERVAL_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="interval count"
            value={planConfig.trial.intervalCount}
            min={1}
            max={30}
            onChange={(v) => updatePlanConfig({ trial: { ...planConfig.trial, intervalCount: v } })}
          />
          <Slider
            label="total cycles"
            value={planConfig.trial.totalCycles}
            min={1}
            max={5}
            onChange={(v) => updatePlanConfig({ trial: { ...planConfig.trial, totalCycles: v } })}
          />
          <Slider
            label="price"
            value={planConfig.trial.price}
            min={0}
            max={50}
            unit=" USD"
            onChange={(v) => updatePlanConfig({ trial: { ...planConfig.trial, price: v } })}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
        <p className="text-xs font-semibold text-ink">Regular 阶段</p>
        <label className="flex flex-col gap-1 text-xs text-muted">
          <span className="text-ink">interval unit</span>
          <select
            value={planConfig.regular.intervalUnit}
            onChange={(e) => updatePlanConfig({ regular: { ...planConfig.regular, intervalUnit: e.target.value as IntervalUnit } })}
            className="rounded border border-line bg-surface2 px-2 py-1 text-ink"
          >
            {INTERVAL_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <Slider
          label="interval count"
          value={planConfig.regular.intervalCount}
          min={1}
          max={12}
          onChange={(v) => updatePlanConfig({ regular: { ...planConfig.regular, intervalCount: v } })}
        />
        <Slider
          label="price"
          value={planConfig.regular.price}
          min={1}
          max={500}
          unit=" USD"
          onChange={(v) => updatePlanConfig({ regular: { ...planConfig.regular, price: v } })}
        />
        <Slider
          label="total cycles（0 = 无限续费）"
          value={planConfig.regular.totalCycles}
          min={0}
          max={24}
          onChange={(v) => updatePlanConfig({ regular: { ...planConfig.regular, totalCycles: v } })}
        />
      </div>

      {planType === 'setupFee' && (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
          <p className="text-xs font-semibold text-ink">Setup Fee</p>
          <Slider
            label="amount"
            value={planConfig.setupFee.amount}
            min={0}
            max={100}
            unit=" USD"
            onChange={(v) => updatePlanConfig({ setupFee: { ...planConfig.setupFee, amount: v } })}
          />
          <label className="flex flex-col gap-1 text-xs text-muted">
            <span className="text-ink">failure action</span>
            <select
              value={planConfig.setupFee.failureAction}
              onChange={(e) =>
                updatePlanConfig({ setupFee: { ...planConfig.setupFee, failureAction: e.target.value as 'CONTINUE' | 'CANCEL' } })
              }
              className="rounded border border-line bg-surface2 px-2 py-1 text-ink"
            >
              <option value="CONTINUE">CONTINUE</option>
              <option value="CANCEL">CANCEL</option>
            </select>
          </label>
        </div>
      )}

      <Slider
        label="payment failure threshold"
        value={planConfig.paymentFailureThreshold}
        min={1}
        max={5}
        onChange={(v) => updatePlanConfig({ paymentFailureThreshold: v })}
      />

      <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
        <p className="text-xs font-semibold text-ink">Tax</p>
        <Slider
          label="percentage"
          value={planConfig.tax.percentage}
          min={0}
          max={20}
          unit="%"
          onChange={(v) => updatePlanConfig({ tax: { ...planConfig.tax, percentage: v } })}
        />
        <label className="flex items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={planConfig.tax.inclusive}
            onChange={(e) => updatePlanConfig({ tax: { ...planConfig.tax, inclusive: e.target.checked } })}
          />
          inclusive（含税价，否则在价格外额外加税）
        </label>
      </div>
    </Card>
  )
}
