import type {BrowserContext, WebSocketRoute} from "@playwright/test"
import {call, parseJson} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {ClientMessageType, RelayMessageType, isClientEvent, isClientReq} from "@welshman/net"
import type {ClientMessage, RelayMessage} from "@welshman/net"
import type {RelayConnection} from "../zooid/types"
import type {Zooid} from "../zooid/relay"
import {makeContextStore} from "./context"
import {isDevServerUrl} from "./http"

export type Direction = "toRelay" | "toClient"

export type TranscriptEntry = {
  url: string
  direction: Direction
  message: ClientMessage | RelayMessage
}

// An event the client published, and the relay it went to.
export type PublishedEvent = {
  url: string
  event: TrustedEvent
}

type Traffic = {
  transcript: TranscriptEntry[]
  leaks: Set<string>
  forgotten: Set<string>
  silenced: Set<string>
  eoseless: Set<string>
}

const trafficStore = makeContextStore<Traffic>("installWebSocketRoutes")

// A relay that holds nothing, so a leak fails on the assertion naming it rather than on a timeout.
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

// A relay that serves what it has and never says it is done, so a request runs out its own deadline.
const openEoselessRelay = (connection: RelayConnection): RelayConnection => ({
  onMessage(listener) {
    connection.onMessage(message => {
      if (message[0] !== RelayMessageType.Eose) {
        listener(message)
      }
    })
  },
  send: message => connection.send(message),
  close: () => connection.close(),
})

// A relay that takes the socket and says nothing, so the only way out is the caller's own deadline.
const openSilentRelay = (): RelayConnection => ({
  onMessage() {},
  send() {},
  close() {},
})

const serve = (traffic: Traffic, zooid: Zooid, route: WebSocketRoute) => {
  const url = normalizeRelayUrl(route.url())
  const connection = call(() => {
    if (traffic.silenced.has(url)) {
      return openSilentRelay()
    }

    if (traffic.forgotten.has(url)) {
      return openEmptyRelay()
    }

    const relay = zooid.relays.get(url)

    if (relay) {
      const connection = relay.connect()

      return traffic.eoseless.has(url) ? openEoselessRelay(connection) : connection
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

/** The single interception point for relay traffic. On the context, so it covers a page opened later. */
export const installWebSocketRoutes = (context: BrowserContext, zooid: Zooid) => {
  const traffic = trafficStore.set(context, {
    transcript: [],
    leaks: new Set(),
    forgotten: new Set(),
    silenced: new Set(),
    eoseless: new Set(),
  })

  return context.routeWebSocket(
    url => !isDevServerUrl(url),
    route => serve(traffic, zooid, route),
  )
}

export const getTranscript = (context: BrowserContext) => trafficStore.get(context).transcript

// Every event this context put on the wire, oldest first. One event on three relays is three entries.
export const getPublished = (context: BrowserContext): PublishedEvent[] =>
  getTranscript(context)
    .filter(
      ({direction, message}) => direction === "toRelay" && message[0] === ClientMessageType.Event,
    )
    .map(({url, message}) => ({url, event: message[1] as TrustedEvent}))

// The same, narrowed to one kind, for asking what the client published rather than what it rendered.
export const getPublishedEvents = (context: BrowserContext, kind: number) =>
  getPublished(context)
    .filter(({event}) => event.kind === kind)
    .map(({event}) => event)

// `serve` resolves a relay once, at open, so a socket already open keeps its relay until a reload.
export const forgetRelay = (context: BrowserContext, url: string) =>
  trafficStore.get(context).forgotten.add(normalizeRelayUrl(url))

// Resolved at open, like forgetRelay, so a page that boots into the fault passes `silent` to `as`.
export const silenceRelay = (context: BrowserContext, url: string) =>
  trafficStore.get(context).silenced.add(normalizeRelayUrl(url))

// Resolved at open too, so a page that boots into it passes `eoseless` to `as`.
export const withholdEose = (context: BrowserContext, url: string) =>
  trafficStore.get(context).eoseless.add(normalizeRelayUrl(url))

// Every frame in both directions, oldest first. Attach it to a failing test.
export const formatTranscript = (context: BrowserContext) =>
  getTranscript(context)
    .map(
      ({url, direction, message}) =>
        `${direction === "toRelay" ? ">>" : "<<"} ${url} ${JSON.stringify(message)}`,
    )
    .join("\n")

export const assertNoLeaks = (context: BrowserContext) => {
  const {leaks} = trafficStore.get(context)

  if (leaks.size > 0) {
    throw new Error(
      [
        `The app opened a websocket to ${leaks.size} url(s) the scenario never created:`,
        ...Array.from(leaks).map(url => `  ${url}`),
      ].join("\n"),
    )
  }
}
