import type {BrowserContext, WebSocketRoute} from "@playwright/test"
import {call, parseJson} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import {RelayMessageType, isClientEvent, isClientReq} from "@welshman/net"
import type {ClientMessage, RelayMessage} from "@welshman/net"
import type {RelayConnection} from "../zooid/types"
import type {Zooid} from "../zooid/relay"
import {isDevServerUrl} from "./http"

export type Direction = "toRelay" | "toClient"

export type TranscriptEntry = {
  url: string
  direction: Direction
  message: ClientMessage | RelayMessage
}

type Traffic = {
  transcript: TranscriptEntry[]
  leaks: Set<string>
  forgotten: Set<string>
}

const trafficByContext = new WeakMap<BrowserContext, Traffic>()

const getTraffic = (context: BrowserContext) => {
  const traffic = trafficByContext.get(context)

  if (traffic) {
    return traffic
  }

  throw new Error("installWebSocketRoutes was never called for this browser context")
}

// A relay that holds nothing: REQs get an immediate EOSE and events are accepted into the void.
// Only urls the container does not serve get one, so a leak fails on the assertion that names it
// rather than on a timeout three layers away.
const openEmptyRelay = (): RelayConnection => {
  let listener: (message: RelayMessage) => void = () => undefined

  return {
    onMessage(f) {
      listener = f
    },
    send(message) {
      if (isClientReq(message)) {
        listener([RelayMessageType.Eose, message[1]])
      } else if (isClientEvent(message)) {
        listener([RelayMessageType.Ok, message[1].id, true, ""])
      }
    },
    close() {},
  }
}

const serve = (traffic: Traffic, zooid: Zooid, route: WebSocketRoute) => {
  const url = normalizeRelayUrl(route.url())
  const connection = call(() => {
    if (traffic.forgotten.has(url)) {
      return openEmptyRelay()
    }

    const relay = zooid.relays.get(url)

    if (relay) {
      return relay.connect()
    }

    traffic.leaks.add(url)

    return openEmptyRelay()
  })

  connection.onMessage(message => {
    traffic.transcript.push({url, direction: "toClient", message})
    route.send(JSON.stringify(message))
  })

  route.onMessage(frame => {
    const message = parseJson<ClientMessage>(frame.toString())

    if (message) {
      traffic.transcript.push({url, direction: "toRelay", message})
      connection.send(message)
    }
  })

  route.onClose(() => connection.close())
}

/**
 * The single interception point for relay traffic. It goes on the context rather than a page, so
 * every page in it is covered including ones opened later, and it is safe to call before any page
 * exists — routing is the environment a page is born into, not a step in a sequence.
 *
 * Vite's hmr socket is the one url left alone. Everything else is answered from this process, and
 * a url that is not one of the container's virtual relays is served by an empty relay and recorded
 * as a leak.
 */
export const installWebSocketRoutes = (context: BrowserContext, zooid: Zooid) => {
  const traffic: Traffic = {transcript: [], leaks: new Set(), forgotten: new Set()}

  trafficByContext.set(context, traffic)

  return context.routeWebSocket(
    url => !isDevServerUrl(url),
    route => serve(traffic, zooid, route),
  )
}

export const getTranscript = (context: BrowserContext) => getTraffic(context).transcript

// Retention, as this context sees it: from here on the relay answers like one that never held
// anything, while staying a url the scenario declared rather than becoming a leak. Sockets already
// open keep the relay they were opened against — `serve` resolves once, at open — so the drop takes
// effect on the next connection, which is what a reload gives it.
export const forgetRelay = (context: BrowserContext, url: string) =>
  getTraffic(context).forgotten.add(normalizeRelayUrl(url))

// Every frame in both directions, oldest first. Attach it to a failing test to see what the client
// actually said, and to whom.
export const formatTranscript = (context: BrowserContext) =>
  getTranscript(context)
    .map(
      ({url, direction, message}) =>
        `${direction === "toRelay" ? ">>" : "<<"} ${url} ${JSON.stringify(message)}`,
    )
    .join("\n")

export const assertNoLeaks = (context: BrowserContext) => {
  const {leaks} = getTraffic(context)

  if (leaks.size > 0) {
    throw new Error(
      [
        `The app opened a websocket to ${leaks.size} url(s) the scenario never created:`,
        ...Array.from(leaks).map(url => `  ${url}`),
      ].join("\n"),
    )
  }
}
