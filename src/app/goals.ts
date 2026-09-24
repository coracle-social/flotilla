import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {now, removeUndefined} from "@welshman/lib"
import {fromMsats} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {ZapGoal} from "@welshman/domain"
import type {Zap} from "@welshman/domain"
import {ZapGoals} from "@welshman/app"
import {app, reader} from "@app/core"

export type GoalProgress = {
  zaps: Zap[]
  raised: number
  target: number
  percent: number
  backers: string[]
  isFunded: boolean
  isEnded: boolean
  closedAt?: number
}

// Welshman tallies a goal in millisats, and comparing there avoids funding a rounded sat early.
export const deriveGoalProgress = (event: TrustedEvent, url?: string): Readable<GoalProgress> => {
  const closedAt = reader(ZapGoal)(event).closedAt()
  const progress = app
    .get()
    .use(ZapGoals)
    .progress(event, removeUndefined([url])).$

  return derived(progress, $progress => ({
    zaps: $progress.zaps,
    raised: fromMsats($progress.amount),
    target: fromMsats($progress.target),
    percent: $progress.target > 0 ? Math.round(($progress.amount / $progress.target) * 100) : 0,
    backers: $progress.contributors,
    isFunded: $progress.target > 0 && $progress.amount >= $progress.target,
    isEnded: Boolean(closedAt && closedAt < now()),
    closedAt,
  }))
}
