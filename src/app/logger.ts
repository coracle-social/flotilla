import type {Unsubscriber} from "svelte/store"
import {Capacitor} from "@capacitor/core"
import {tryCatch} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {DirectMessage} from "@welshman/domain"
import type {Logger} from "@welshman/app"
import {logger, wraps, writer} from "@app/core"
import {PLATFORM_LOGEE} from "@app/env"

const formatValue = (value: unknown) => {
  if (value instanceof Error) {
    return value.stack || value.message
  }
  if (typeof value === "string") {
    return value
  }

  return tryCatch(() => JSON.stringify(value)) || String(value)
}

const bindLogging = ($logger: Logger) => {
  const {error} = console

  const log = (source: string, value: unknown) => $logger.log(source, {message: formatValue(value)})

  const onError = (event: ErrorEvent) => log("error", event.error || event.message)

  const onUnhandledRejection = (event: PromiseRejectionEvent) => log("rejection", event.reason)

  console.error = (...args: unknown[]) => {
    log("console", args.map(formatValue).join(" "))
    error(...args)
  }

  $logger.log("app", {
    platform: Capacitor.getPlatform(),
    build: import.meta.env.VITE_BUILD_HASH,
    userAgent: navigator.userAgent,
  })

  window.addEventListener("error", onError)
  window.addEventListener("unhandledrejection", onUnhandledRejection)

  return () => {
    console.error = error
    window.removeEventListener("error", onError)
    window.removeEventListener("unhandledrejection", onUnhandledRejection)
  }
}

// Logging in swaps in a fresh app with an empty log, so re-bind against the new one.
export const setupLogging = () => {
  let unbind: Maybe<Unsubscriber>

  const unsubscribe = logger.subscribe($logger => {
    unbind?.()
    unbind = bindLogging($logger)
  })

  return () => {
    unbind?.()
    unsubscribe()
  }
}

export const sendLogs = async () => {
  const messages = logger.get().messages.get()
  const lines: string[] = []
  let size = 0

  // Relays commonly cap events at 64kb, so send only as much recent history as will fit
  for (const message of messages.slice().reverse()) {
    const line = JSON.stringify(message)

    size += line.length

    if (size > 32_000) {
      break
    }

    lines.unshift(line)
  }

  const event = await writer(DirectMessage)
    .setContent("```" + lines.join("\n") + "```")
    .addRecipient(PLATFORM_LOGEE)
    .renderTemplate()

  return wraps.get().publish({event, recipients: [PLATFORM_LOGEE], pow: 16})
}
