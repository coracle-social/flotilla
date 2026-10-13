import {derived, get, readable} from "svelte/store"
import {ago, avg, ms, now, spec} from "@welshman/lib"
import {makeHttpAuth, makeHttpAuthHeader} from "@welshman/util"
import {throttled} from "@welshman/store"
import {Logger} from "@welshman/app"
import type {LogMessage} from "@welshman/app"
import {fromApp, user} from "@app/core/app"
import {navigate} from "@app/ui/modal"
import {pushToast, toast} from "@app/ui/toast"

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

// Checked on a timer rather than on change, so an alert held back by another toast still goes out.
export const syncSignerAlerts = () =>
  throttled(ms(10), signerHealth).subscribe(({unresponsive}) => {
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

const httpAuthByUrl = new Map<
  string,
  {pubkey: string; expiresAt: number; header: Promise<string>}
>()

// A NIP-98 GET token for url, reused for maxAge seconds by the same pubkey where the server allows it.
export const getHttpAuthHeader = (url: string, maxAge = 0) => {
  const {pubkey, signer} = user.get()
  const cached = httpAuthByUrl.get(url)

  if (cached?.pubkey === pubkey && cached.expiresAt > now()) {
    return cached.header
  }

  const header = makeHttpAuth(url, "GET")
    .then(template => signer.sign(template))
    .then(makeHttpAuthHeader)

  // A declined signature shouldn't be cached, or the user can't retry.
  header.catch(() => {
    if (httpAuthByUrl.get(url)?.header === header) {
      httpAuthByUrl.delete(url)
    }
  })

  httpAuthByUrl.set(url, {pubkey, expiresAt: now() + maxAge, header})

  return header
}
