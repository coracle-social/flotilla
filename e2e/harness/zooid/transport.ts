import {request as httpRequest} from "node:http"
import WebSocket from "ws"
import {parseJson} from "@welshman/lib"
import type {ClientMessage, RelayMessage} from "@welshman/net"
import type {RelayConnection} from "./types"

/** The only place that knows the container has a loopback address. A relay selection drops a local url. */

// Must match the published port in zooid/docker/compose.yaml.
export const port = 3334

const headersFor = (host: string) => ({Host: host, "X-Forwarded-Proto": "https"})

export type ZooidConnection = RelayConnection & {
  // Resolves with the first message the relay sends that matches.
  wait(match: (message: RelayMessage) => boolean): Promise<RelayMessage>
}

// Node's own WebSocket cannot carry a Host header, which fetch forbids, so this depends on `ws`.
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

  // A 404 from zooid's dispatcher means `tenants` and the tenant toml's `host` have drifted apart.
  socket.on("error", error =>
    console.error(`The zooid container refused a socket for ${host}: ${error.message}`),
  )

  return {
    onMessage: listener => {
      listeners.add(listener)
    },
    // A client may speak before the container has finished its handshake.
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

// Carries the same two headers, so the nip-11 and nip-86 answers the browser reads are the relay's.
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
          // A pseudo-header describes the request line, and node:http rejects a header name with a colon in it.
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
          // Hop-by-hop headers describe the connection this answer arrived on, not the browser's.
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
