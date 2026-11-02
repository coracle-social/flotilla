import type {SignedEvent} from "@welshman/util"
import {buildUrl} from "@lib/util"
import {PUSH_SERVER} from "@app/core/env"

export const createPushSubscription = (channel: string, token: string, signal: AbortSignal) =>
  fetch(buildUrl(PUSH_SERVER, "subscription", channel), {
    signal,
    method: "POST",
    body: JSON.stringify({token}),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  })

export const deletePushSubscription = (key: string) =>
  fetch(buildUrl(PUSH_SERVER, "subscription", key), {method: "delete"})

export type Reminder = {
  at: number
  title: string
  body: string
}

export type ReminderSchedule = {
  id: string
  relay: string
  event?: SignedEvent
  notifications: Reminder[]
}

export const putReminderSchedule = (key: string, schedule: ReminderSchedule) =>
  fetch(buildUrl(PUSH_SERVER, "subscription", key, "schedule"), {
    method: "PUT",
    headers: {Accept: "application/json", "Content-Type": "application/json"},
    body: JSON.stringify(schedule),
  })

export const deleteReminderSchedule = (key: string) =>
  fetch(buildUrl(PUSH_SERVER, "subscription", key, "schedule"), {method: "DELETE"})
