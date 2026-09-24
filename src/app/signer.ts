import {derived} from "svelte/store"
import {Logger} from "@welshman/app"
import type {LogMessage} from "@welshman/app"
import {fromApp} from "@app/core"

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
