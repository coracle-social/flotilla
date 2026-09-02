import {request as httpRequest} from "node:http"
import WebSocket from "ws"
import {parseJson} from "@welshman/lib"
import type {ClientMessage, RelayMessage} from "@welshman/net"
import type {RelayConnection} from "./types"

/**
 * How the harness reaches the zooid container, and the only place that knows it has a loopback
 * address at all.
 *
 * The client is given `wss://<tenant>.test/` and never learns anything else. A relay selection
 * drops a url that is local or insecure unless the caller opts in, which Flotilla never does
 * (isLocalUrl and RelaySelection.getUrls in @welshman/util), so the container's own
 * `ws://localhost:3334/` would leave the Router resolving every outbox load, profile and relay hint
 * to nothing.
 *
 * The two headers below make the container answer to that name, and are what a tls terminator adds
 * in front of a real deployment. zooid's dispatcher binds a config to a Host (cmd/relay/main.go),
 * and khatru derives the url it checks nip-42 and nip-86 signatures against from that Host plus the
 * forwarded proto (getBaseURL in khatru/relay.go).
 */

// Must match the published port in zooid/docker/compose.yaml.
export const port = 3334

const headersFor = (host: string) => ({Host: host, "X-Forwarded-Proto": "https"})

export type ZooidConnection = RelayConnection & {
  // Resolves with the first message the relay sends that matches. Seeding waits for its auth
  // challenge and for the OK answering each write this way.
  wait(match: (message: RelayMessage) => boolean): Promise<RelayMessage>
}

// One connection to the container, as one of its virtual relays. Node's own WebSocket cannot carry
// a Host header, which fetch forbids, so the harness depends on `ws` for this alone.
export const connectToZooid = (host: string): ZooidConnection => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/`, {headers: headersFor(host)})
  const listeners = new Set<(message: RelayMessage) => void>()
  const pending: ClientMessage[] = []

  const write = (message: ClientMessage) => socket.send(JSON.stringify(message))

  socket.on("open", () => pending.splice(0).forEach(write))

  socket.on("message", data => {
    const message = parseJson<RelayMessage>(data.toString())

    if (message) {
      for (const listener of listeners) {
        listener(message)
      }
    }
  })

  // The likeliest error here is a 404 from zooid's dispatcher, which means `tenants` in config.ts
  // and the `host` in the tenant's toml have drifted apart.
  socket.on("error", error =>
    console.error(`The zooid container refused a socket for ${host}: ${error.message}`),
  )

  return {
    onMessage: listener => {
      listeners.add(listener)
    },
    // A client may speak before the container has finished its handshake. The page's socket is open
    // as soon as playwright has a route for it, well before this one is.
    send: message => {
      if (socket.readyState === WebSocket.OPEN) {
        write(message)
      } else {
        pending.push(message)
      }
    },
    close: () => socket.close(),
    wait: match =>
      new Promise(resolve => {
        const listener = (message: RelayMessage) => {
          if (match(message)) {
            listeners.delete(listener)
            resolve(message)
          }
        }

        listeners.add(listener)
      }),
  }
}

export type ZooidResponse = {
  status: number
  headers: Record<string, string>
  body: Buffer
}

// One http request to the container, carrying the same two headers, so the nip-11 document and the
// nip-86 management api the browser reads are the real relay's.
export const requestZooid = (
  host: string,
  method: string,
  path: string,
  requestHeaders: Record<string, string>,
  body?: Buffer,
): Promise<ZooidResponse> =>
  new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        method,
        path,
        host: "127.0.0.1",
        port,
        headers: {
          // A pseudo-header describes the request line rather than the request, and node:http
          // rejects a header name with a colon in it.
          ...Object.fromEntries(
            Object.entries(requestHeaders).filter(([name]) => !name.startsWith(":")),
          ),
          ...headersFor(host),
        },
      },
      response => {
        const chunks: Buffer[] = []
        const responseHeaders: Record<string, string> = {}

        for (const [name, value] of Object.entries(response.headers)) {
          // Hop-by-hop headers describe the connection this answer arrived on, not the one the
          // browser is waiting on, which playwright frames itself.
          if (value && !["connection", "keep-alive", "transfer-encoding"].includes(name)) {
            responseHeaders[name] = Array.isArray(value) ? value.join(", ") : value
          }
        }

        response.on("data", chunk => chunks.push(chunk))
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 500,
            headers: responseHeaders,
            body: Buffer.concat(chunks),
          }),
        )
      },
    )

    request.on("error", reject)
    request.end(body)
  })
