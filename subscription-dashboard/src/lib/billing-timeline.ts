import type { IntervalUnit, PlanConfig } from './plan-config'

export interface TimelineEvent {
  day: number
  label: string
  amount: number
}

const INTERVAL_DAYS: Record<IntervalUnit, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
}

function intervalToDays(unit: IntervalUnit, count: number): number {
  return INTERVAL_DAYS[unit] * count
}

const INFINITE_PREVIEW_CYCLES = 3

export function computeBillingTimeline(config: PlanConfig): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({ day: 0, label: '批准订阅', amount: 0 })

  if (config.setupFee.amount > 0) {
    events.push({
      day: 0,
      label: `收取 Setup Fee $${config.setupFee.amount}`,
      amount: config.setupFee.amount,
    })
  }

  let trialEndDay = 0

  if (config.planType === 'trial') {
    const { trial } = config
    const trialIntervalDays = intervalToDays(trial.intervalUnit, trial.intervalCount)
    for (let i = 0; i < trial.totalCycles; i++) {
      events.push({
        day: i * trialIntervalDays,
        label: `试用期扣款 $${trial.price}`,
        amount: trial.price,
      })
    }
    trialEndDay = trial.totalCycles * trialIntervalDays
  }

  const { regular } = config
  const regularIntervalDays = intervalToDays(regular.intervalUnit, regular.intervalCount)
  const infinite = regular.totalCycles === 0
  const regularCycleCount = infinite ? INFINITE_PREVIEW_CYCLES : regular.totalCycles

  let lastRegularDay = trialEndDay
  for (let i = 0; i < regularCycleCount; i++) {
    lastRegularDay = trialEndDay + i * regularIntervalDays
    events.push({
      day: lastRegularDay,
      label: `正式扣款 $${regular.price}`,
      amount: regular.price,
    })
  }

  if (infinite) {
    events.push({
      day: lastRegularDay,
      label: '订阅进入无限续费（预览 3 期，此后持续按周期扣款）',
      amount: 0,
    })
  }

  return events
}
