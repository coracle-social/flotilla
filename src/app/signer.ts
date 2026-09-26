import {derived, get, readable} from "svelte/store"
import {ago, avg, ms, now, spec} from "@welshman/lib"
import {Logger} from "@welshman/app"
import type {LogMessage} from "@welshman/app"
import {fromApp} from "@app/core"
import {navigate} from "@app/modal"
import {pushToast, toast} from "@app/toast"

export type SignerRequest = {
  id: string
  method: string
  startedAt: number
  finishedAt?: number
  ok?: boolean
}

// The logger records one entry per state transition, so fold them back into one per request.
export const signerRequests = derived(
  fromApp($app => $app.use(Logger).messages.$),
  ($messages: LogMessage[]) => {
    const requestsById = new Map<string, SignerRequest>()

    for (const message of $messages) {
      if (message.source !== "signer") {
        continue
      }

      if (message.status === "pending") {
        requestsById.set(message.id, {
          id: message.id,
          method: String(message.method),
          startedAt: message.at,
        })
      } else {
        const request = requestsById.get(message.id)

        if (request) {
          request.finishedAt = message.at
          request.ok = message.status === "success"
        }
      }
    }

    return Array.from(requestsById.values())
  },
)

const clock = readable(now(), set => {
  const interval = setInterval(() => set(now()), ms(1))

  return () => clearInterval(interval)
})

// Logger timestamps are in milliseconds
export const signerHealth = derived([signerRequests, clock], ([$requests]) => {
  const pending = $requests.filter(request => !request.finishedAt)
  const stale = pending.filter(request => request.startedAt < ms(ago(30)))
  const recent = $requests.filter(request => request.finishedAt && request.finishedAt > ms(ago(10)))
  const recentFailures = recent.filter(spec({ok: false}))
  const disconnected = recent.length > 0 && recentFailures.length === recent.length

  return {
    disconnected,
    failing: recentFailures.length > 3,
    slow:
      avg(recent.map(request => request.finishedAt! - request.startedAt)) > 1000 ||
      pending.length > 10,
    unresponsive: stale.length > 10 || (recent.length > 5 && disconnected),
  }
})

export const syncSignerAlerts = () =>
  derived(signerHealth, $signerHealth => $signerHealth.unresponsive).subscribe(unresponsive => {
    if (unresponsive && !get(toast)) {
      pushToast({
        theme: "error",
        timeout: 60_000,
        message: "Your signer isn't responding.",
        action: {
          message: "Details",
          onclick: () => navigate("/settings/profile"),
        },
      })
    }
  })
