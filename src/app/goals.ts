import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {now, removeUndefined, sortBy} from "@welshman/lib"
import {fromMsats} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {ZapGoal} from "@welshman/domain"
import type {Zap} from "@welshman/domain"
import {Domain, ZapGoals} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {app} from "@app/core"

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

export type GoalFilter = "all" | "live" | "funded" | "ended"

export type GoalSort = "active" | "new" | "progress" | "ending"

export class GoalProgresses {
  private progressByKey = new Map<string, Readable<GoalProgress>>()

  constructor(private readonly app: IApp) {}

  forGoal = (event: TrustedEvent, url?: string) => {
    const key = `${event.id}:${url ?? ""}`
    let progress = this.progressByKey.get(key)

    if (!progress) {
      progress = this.derive(event, url)
      this.progressByKey.set(key, progress)
    }

    return progress
  }

  // Welshman tallies a goal in millisats, and comparing there avoids funding a rounded sat early.
  private derive = (event: TrustedEvent, url?: string): Readable<GoalProgress> => {
    const closedAt = this.app.use(Domain).reader(ZapGoal)(event).closedAt()
    const progress = this.app.use(ZapGoals).progress(event, removeUndefined([url])).$

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
}

export const deriveGoalProgress = (event: TrustedEvent, url?: string) =>
  app.get().use(GoalProgresses).forGoal(event, url)

// `derived` over no stores never fires, so an empty board needs a store of its own.
export const deriveGoalProgressById = (goals: TrustedEvent[], url: string) =>
  goals.length > 0
    ? derived(
        goals.map(event => deriveGoalProgress(event, url)),
        progresses => new Map(progresses.map((progress, i) => [goals[i]!.id, progress])),
      )
    : readable(new Map<string, GoalProgress>())

export const getGoalTotals = (progressById: Map<string, GoalProgress>) => {
  const backers = new Set<string>()
  let raised = 0
  let funded = 0

  for (const progress of progressById.values()) {
    raised += progress.raised
    funded += progress.isFunded ? 1 : 0

    for (const backer of progress.backers) {
      backers.add(backer)
    }
  }

  return {raised, funded, backers: backers.size}
}

export const filterGoals = (
  filter: GoalFilter,
  goals: TrustedEvent[],
  progressById: Map<string, GoalProgress>,
) =>
  goals.filter(event => {
    const progress = progressById.get(event.id)

    if (filter === "live") {
      return Boolean(progress && !progress.isEnded && !progress.isFunded)
    }

    if (filter === "funded") {
      return Boolean(progress?.isFunded)
    }

    if (filter === "ended") {
      return Boolean(progress?.isEnded)
    }

    return true
  })

export const sortGoals = (
  sort: GoalSort,
  goals: TrustedEvent[],
  progressById: Map<string, GoalProgress>,
  activeAt: Map<string, number>,
) => {
  if (sort === "new") {
    return sortBy(event => -event.created_at, goals)
  }

  if (sort === "progress") {
    return sortBy(event => -(progressById.get(event.id)?.percent ?? 0), goals)
  }

  if (sort === "ending") {
    return sortBy(event => {
      const closedAt = progressById.get(event.id)?.closedAt

      return closedAt && closedAt > now() ? closedAt : Infinity
    }, goals)
  }

  return sortBy(event => -(activeAt.get(event.id) ?? event.created_at), goals)
}
