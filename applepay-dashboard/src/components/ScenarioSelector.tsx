import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SCENARIOS } from '@/scenarios/types'
import type { ApplePayScenario, ScenarioMeta } from '@/scenarios/types'

interface ScenarioSelectorProps {
  value: ApplePayScenario
  onChange: (scenario: ApplePayScenario) => void
  disabled?: boolean
}

const gradients: Record<ScenarioMeta['badgeColor'], string> = {
  blue: 'from-blue-50 to-blue-100/50 border-blue-200 hover:border-blue-400',
  green: 'from-green-50 to-green-100/50 border-green-200 hover:border-green-400',
  purple: 'from-purple-50 to-purple-100/50 border-purple-200 hover:border-purple-400',
}

const selectedRings: Record<ScenarioMeta['badgeColor'], string> = {
  blue: 'ring-2 ring-blue-500 border-blue-500',
  green: 'ring-2 ring-green-500 border-green-500',
  purple: 'ring-2 ring-purple-500 border-purple-500',
}

const iconColors: Record<ScenarioMeta['badgeColor'], string> = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  purple: 'text-purple-500',
}

export function ScenarioSelector({ value, onChange, disabled }: ScenarioSelectorProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        选择支付场景
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {SCENARIOS.map((scenario) => {
          const isSelected = value === scenario.id
          return (
            <button
              key={scenario.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(scenario.id)}
              className={cn(
                'relative text-left rounded-xl border bg-gradient-to-br p-4 transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:pointer-events-none disabled:opacity-60',
                gradients[scenario.badgeColor],
                isSelected && selectedRings[scenario.badgeColor],
              )}
            >
              {isSelected && (
                <CheckCircle2
                  className={cn('absolute top-3 right-3 h-5 w-5', iconColors[scenario.badgeColor])}
                />
              )}
              <Badge variant={scenario.badgeColor} className="mb-3">
                {scenario.badge}
              </Badge>
              <div className="font-semibold text-sm text-foreground mb-1">{scenario.label}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {scenario.description}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
