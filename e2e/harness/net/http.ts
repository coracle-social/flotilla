import {createHash} from "node:crypto"
import type {BrowserContext} from "@playwright/test"
import {HOUR, int, now, omit} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {Handle} from "@welshman/util"
import type {ZapperValues} from "@welshman/domain"
import {tenantByUrl} from "../zooid/config"
import {requestZooid} from "../zooid/transport"
import {makeContextStore} from "./context"

// Mirrors the service urls in src/app/env.ts, which reads import.meta.env and pulls in Capacitor.
const DUFFLEPUD_ORIGIN = "https://dufflepud.coracle.social"
const PUSH_SERVER_ORIGIN = "https://nps.flotilla.social"
const HOSTING_ORIGIN = "https://api.hosting.coracle.social"

// Hard-coded in src/app.html, so every navigation asks for it whatever the scenario is doing.
const PLAUSIBLE_ORIGIN = "https://plausible.coracle.social"

// Transcription and speech both go here, against whichever key the user has saved.
const OPENROUTER_ORIGIN = "https://openrouter.ai"

// .test resolves nowhere and the block-all aborts the navigation, so a spec sees the redirect.
const CHECKOUT_ORIGIN = "https://checkout.test"

// Relay-hosted livekit lives under a well-known path rather than an origin of its own.
const LIVEKIT_PATH = "/.well-known/nip29/livekit"

// A 1x1 transparent png, small enough to inline and real enough for an <img> to decode.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=",
  "base64",
)

// The dev server. Traffic to it is the app loading itself, so it is the one host both layers pass.
export const isDevServerUrl = (url: URL) =>
  url.port === (process.env.E2E_PORT ?? "1847") &&
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)

// A relay is reached over wss and its own http origin is where nip-11 and nip-86 live.
const relayOrigin = (url: string) => new URL(url.replace(/^ws/, "http")).origin

const hostByOrigin = new Map(
  Array.from(tenantByUrl, ([url, host]): [string, string] => [relayOrigin(url), host]),
)

export type BlockedRequest = {
  method: string
  url: string
}

const blockedStore = makeContextStore<BlockedRequest[]>("installHttpRoutes")

/** Blocks every http request but the dev server's and a relay's own origin. Install this first. */
export const installHttpRoutes = (context: BrowserContext) => {
  const blocked = blockedStore.set(context, [])

  // A sveltekit page in dev is hundreds of module requests, and none of them is egress.
  return context.route(
    url => !isDevServerUrl(url),
    async route => {
      const request = route.request()
      const {origin, pathname, search} = new URL(request.url())

      const host = hostByOrigin.get(origin)

      if (host) {
        return route.fulfill(
          await requestZooid(
            host,
            request.method(),
            pathname + search,
            request.headers(),
            request.postDataBuffer() ?? undefined,
          ),
        )
      }

      blocked.push({method: request.method(), url: request.url()})

      return route.abort()
    },
  )
}

/** Opt-in: some of what a page asks for is meant to be refused, so call it from a spec rather than teardown. */
export const assertNoBlockedRequests = (context: BrowserContext) => {
  const blocked = blockedStore.get(context)

  if (blocked.length > 0) {
    throw new Error(
      [
        `The app made ${blocked.length} http request(s) nothing served:`,
        ...blocked.map(({method, url}) => `  ${method} ${url}`),
      ].join("\n"),
    )
  }
}

// Fields to merge over a relay's own nip-11 document, keyed by its url.
export type RelayInfoOverrides = Record<string, object>

/** A relay's real document with a few fields replaced. It is read at startup, so install it before navigating. */
export const mockRelayInfo = (context: BrowserContext, overrides: RelayInfoOverrides) => {
  const overrideByOrigin = new Map(
    Object.entries(overrides).map(([url, override]): [string, object] => [
      relayOrigin(url),
      override,
    ]),
  )

  return context.route(
    url => url.pathname === "/" && overrideByOrigin.has(url.origin),
    async route => {
      const request = route.request()
      const {origin} = new URL(request.url())
      const host = hostByOrigin.get(origin)
      const override = overrideByOrigin.get(origin)

      // The nip-86 management api posts to this same path, so only the document request is touched.
      if (request.method() === "GET" && host && override) {
        const {status, headers, body} = await requestZooid(host, "GET", "/", {
          ...request.headers(),
          // The merge has to read the document, and khatru compresses it when invited to.
          "accept-encoding": "identity",
        })

        return route.fulfill({
          status,
          // khatru's Access-Control-Allow-Origin is what makes the fetch legal, so the relay's headers are kept.
          headers: omit(["content-length"], headers),
          body: JSON.stringify({...JSON.parse(body.toString()), ...override}),
        })
      }

      return route.fallback()
    },
  )
}

/** The analytics script src/app.html loads. An empty body leaves window.plausible as the queueing shim. */
export const mockAnalytics = (context: BrowserContext) =>
  context.route(`${PLAUSIBLE_ORIGIN}/**`, route =>
    route.fulfill({contentType: "application/javascript", body: ""}),
  )

export type DufflepudFixtures = {
  // The remote half of the read-state sync in src/app/notifications.ts, keyed by path.
  checked?: Record<string, number>
  // A link preview is only rendered when it carries a title or an image.
  preview?: {title?: string; description?: string; image?: string}
  handles?: {handle: string; info?: Handle}[]
  // `lnurl` is hex here rather than bech32, which is the encoding dufflepud speaks.
  zappers?: {lnurl: string; info?: Omit<ZapperValues, "lnurl">}[]
}

/** Dufflepud, the one service url the app hard-codes. `as()` installs it with no fixtures, so a spec calls this again. */
export const mockDufflepud = (context: BrowserContext, fixtures: DufflepudFixtures = {}) =>
  context.route(`${DUFFLEPUD_ORIGIN}/**`, route => {
    const {pathname} = new URL(route.request().url())

    if (pathname === "/link/preview") {
      return route.fulfill({json: fixtures.preview ?? {}})
    }

    if (pathname === "/handle/info") {
      return route.fulfill({json: {data: fixtures.handles ?? []}})
    }

    if (pathname === "/zapper/info") {
      return route.fulfill({json: {data: fixtures.zappers ?? []}})
    }

    if (pathname === "/kv/checked") {
      return route.fulfill({
        json: route.request().method() === "GET" ? (fixtures.checked ?? {}) : {},
      })
    }

    return route.fallback()
  })

// The app decodes what it is answered and writes its own header from the result.
const SPEECH_RATE = 24000

// Built rather than inlined, so a spec can ask for a length and assert the duration read off it.
const silence = (seconds: number) => {
  const bytes = seconds * SPEECH_RATE * 2
  const wav = Buffer.alloc(44 + bytes)

  wav.write("RIFF", 0)
  wav.writeUInt32LE(36 + bytes, 4)
  wav.write("WAVEfmt ", 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(SPEECH_RATE, 24)
  wav.writeUInt32LE(SPEECH_RATE * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write("data", 36)
  wav.writeUInt32LE(bytes, 40)

  return wav
}

// The harness has no mp3 encoder, so it answers a wav, which the app decodes either way.
const SPEECH_FORMAT = "mp3"

/** OpenRouter's text to speech, answering every request with the same silence. Raw pcm is refused. */
export const mockOpenRouterSpeech = async (context: BrowserContext, seconds = 3) => {
  const spoken: string[] = []

  await context.route(`${OPENROUTER_ORIGIN}/api/v1/audio/speech`, route => {
    const {input, response_format} = JSON.parse(route.request().postData() ?? "{}")

    if (response_format === SPEECH_FORMAT) {
      spoken.push(input)

      return route.fulfill({contentType: "audio/wav", body: silence(seconds)})
    }

    return route.fulfill({
      status: 400,
      json: {error: {message: `Invalid option: expected ${SPEECH_FORMAT}`}},
    })
  })

  return spoken
}

export type Transcription = {
  // OpenRouter picks a decoder off the extension, so this is how a spec reads what the recorder made.
  uploads: string[]
  // Stops answering. A request that arrives while this is on is held open until `release`.
  hold(): void
  release(): void
}

/** OpenRouter's speech to text, answering every recording with the same transcript. */
export const mockOpenRouterTranscription = async (
  context: BrowserContext,
  text: string,
): Promise<Transcription> => {
  const uploads: string[] = []

  let held: Maybe<Promise<void>>
  let release: Maybe<() => void>

  await context.route(`${OPENROUTER_ORIGIN}/api/v1/audio/transcriptions`, async route => {
    const body = route.request().postData() ?? ""

    uploads.push(body.match(/filename="([^"]+)"/)?.[1] ?? "")

    await held

    return route.fulfill({json: {text}})
  })

  return {
    uploads,
    hold: () => {
      held = new Promise<void>(resolve => {
        release = resolve
      })
    },
    release: () => {
      release?.()
      held = undefined
    },
  }
}

// getBlossomServer probes the space's own origin, then the user's kind-10063 list, then this.
export const DEFAULT_BLOSSOM_ORIGIN = "https://blossom.primal.net"

export type BlossomOptions = {
  // The blossom server the scenario expects an upload to land on, e.g. a space's own url.
  server: string
}

/** What a spec can turn on. Each of these is off by default. */
export type BlossomHandle = {
  // A conversation's image is uploaded encrypted, so one end's bytes have to be the other's.
  install(context: BrowserContext): Promise<void>
  // Holds every upload open until `release`, which makes the in-flight state a fact rather than a race.
  hold(): void
  release(): void
  // Refuses every upload probe from here on, with a reason the app has to show.
  refuse(reason: string): void
}

/** A blossom server that keeps what it was given, hashing an upload exactly as the real thing would. */
export const mockBlossom = async (context: BrowserContext, {server}: BlossomOptions) => {
  const {origin} = new URL(server)
  const blobs = new Map<string, {body: Buffer; type: string}>()

  let held = Promise.resolve()
  let open = () => {}
  let refusal = ""

  const handle: BlossomHandle = {
    install: async context => {
      await context.route(`${origin}/**`, async route => {
        const request = route.request()
        const method = request.method()
        const {pathname} = new URL(request.url())

        if (pathname === "/upload") {
          // BUD-06, which the app asks before spending an upload. A refusal exposes its reason cross-origin.
          if (method === "HEAD") {
            if (refusal) {
              return route.fulfill({
                status: 400,
                headers: {
                  "X-Reason": refusal,
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Expose-Headers": "*",
                },
              })
            }

            return route.fulfill({status: 200, body: ""})
          }

          if (method === "PUT") {
            await held

            const body = request.postDataBuffer() ?? Buffer.alloc(0)
            const type = request.headers()["content-type"] ?? "application/octet-stream"
            const sha256 = createHash("sha256").update(body).digest("hex")

            blobs.set(sha256, {body, type})

            return route.fulfill({
              json: {sha256, type, url: `${origin}/${sha256}`, size: body.length, uploaded: now()},
            })
          }
        }

        const blob = blobs.get(pathname.slice(1).split(".")[0])

        if (blob) {
          return route.fulfill({
            contentType: blob.type,
            body: method === "HEAD" ? "" : blob.body,
          })
        }

        return route.fallback()
      })
    },
    hold: () => {
      held = new Promise<void>(resolve => {
        open = resolve
      })
    },
    release: () => open(),
    refuse: reason => {
      refusal = reason
    },
  }

  await handle.install(context)

  return handle
}

/** The push server. Only the native adapters talk to it, so a browser run reaching this is a regression. */
export const mockPushServer = (context: BrowserContext) =>
  context.route(`${PUSH_SERVER_ORIGIN}/**`, route => {
    const [resource] = new URL(route.request().url()).pathname.split("/").filter(Boolean)

    if (resource === "subscription") {
      if (route.request().method() === "DELETE") {
        return route.fulfill({json: {}})
      }

      // The relay is told to post notifications to the callback rather than the client ever fetching it.
      const key = "test-push-subscription"

      return route.fulfill({json: {key, callback: `${PUSH_SERVER_ORIGIN}/callback/${key}`}})
    }

    return route.fallback()
  })

// One record off the hosting api, left loose so mocking a flow doesn't pull import.meta.env in.
export type HostingRecord = Record<string, unknown>

// The backend's state when the page opens.
export type HostingFixtures = {
  plans?: HostingRecord[]
  // Provisioning runs on every login and ignores what it gets back.
  tenant?: HostingRecord
  relays?: HostingRecord[]
  invoices?: HostingRecord[]
  draftInvoice?: HostingRecord
}

// The backend changing its mind between two of the user's clicks, which no click can reach.
export type HostingHandle = {
  setTenant(patch: HostingRecord): void
  setRelay(id: string, patch: HostingRecord): void
  setInvoice(id: string, patch: HostingRecord): void
}

const hostingStore = makeContextStore<HostingHandle>("mockHosting")

export const getHosting = (context: BrowserContext) => hostingStore.get(context)

/** The hosting api as a small stateful fake. Each browser context gets its own store. */
export const mockHosting = async (context: BrowserContext, fixtures: HostingFixtures = {}) => {
  const plans = fixtures.plans ?? []
  const relays = new Map((fixtures.relays ?? []).map(relay => [String(relay.id), relay]))
  const invoices = new Map((fixtures.invoices ?? []).map(invoice => [String(invoice.id), invoice]))

  let tenant: HostingRecord = {
    pubkey: "",
    return_url: "",
    nwc_is_set: false,
    stripe_customer_id: "",
    created_at: now(),
    ...fixtures.tenant,
  }

  const handle: HostingHandle = {
    setTenant: patch => {
      tenant = {...tenant, ...patch}
    },
    setRelay: (id, patch) => {
      relays.set(id, {...relays.get(id), ...patch})
    },
    setInvoice: (id, patch) => {
      invoices.set(id, {...invoices.get(id), ...patch})
    },
  }

  hostingStore.set(context, handle)

  await context.route(`${HOSTING_ORIGIN}/**`, route => {
    const request = route.request()
    const method = request.method()
    // An import posts JSONL, which postDataJSON() throws on. Every other write posts json.
    const isJson = request.headers()["content-type"] === "application/json"
    const body: HostingRecord = (isJson && request.postDataJSON()) || {}
    const [resource, id, sub, detail] = new URL(request.url()).pathname.split("/").filter(Boolean)

    const missing = (what: string) => route.fulfill({status: 404, json: {error: `No such ${what}`}})

    if (resource === "plans") {
      return route.fulfill({json: {data: plans}})
    }

    if (resource === "tenants") {
      // Provisioning is the one tenant route with no pubkey in the path.
      if (id) {
        tenant = {...tenant, pubkey: id}
      } else {
        tenant = {...tenant, ...body}

        return route.fulfill({json: {data: tenant}})
      }

      if (sub === "relays") {
        return route.fulfill({json: {data: Array.from(relays.values())}})
      }

      if (sub === "invoices") {
        const data = detail === "draft" ? fixtures.draftInvoice : Array.from(invoices.values())

        return route.fulfill({json: {data}})
      }

      if (sub === "stripe") {
        return route.fulfill({json: {data: {url: `${CHECKOUT_ORIGIN}/portal/${id}`}}})
      }

      // A wallet is the only thing the app updates a tenant with, so saving one is what sets it.
      if (method === "PUT") {
        tenant = {...tenant, ...body, nwc_is_set: Boolean(body.nwc_url)}
      }

      // GET and reconcile both answer with the tenant as it now stands.
      return route.fulfill({json: {data: tenant}})
    }

    if (resource === "relays") {
      if (!id) {
        const relay = {
          id: `relay-${relays.size + 1}`,
          status: "active",
          sync_error: "",
          synced: now(),
          custom_domain: "",
          custom_domain_verified: 0,
          ...body,
          // A created space is opened straight away, so its url has to be one the container serves.
          zooid_domain: body.zooid_domain || "test",
        }

        relays.set(String(relay.id), relay)

        return route.fulfill({json: {data: relay}})
      }

      const relay = relays.get(id)

      if (!relay) {
        return missing(`relay ${id}`)
      }

      if (sub === "members") {
        return route.fulfill({json: {data: {members: relay.members ?? []}}})
      }

      if (sub === "activity") {
        return route.fulfill({json: {data: {activity: relay.activity ?? []}}})
      }

      // The dump is served as the download itself rather than in a json envelope.
      if (sub === "export") {
        return route.fulfill({
          contentType: "application/x-ndjson",
          body: String(relay.events ?? ""),
        })
      }

      // The fake counts the lines and refuses the ones that don't look signed, as zooid reports them.
      if (sub === "import") {
        const lines = (request.postData() ?? "").split("\n").filter(line => line.trim())
        const problems = lines.flatMap((line, index) =>
          line.includes(`"sig"`) ? [] : [{line: index + 1, event_id: "", message: "invalid event"}],
        )

        return route.fulfill({
          json: {
            data: {imported: lines.length - problems.length, invalid: problems.length, problems},
          },
        })
      }

      const updated = {...relay, ...(method === "PUT" ? body : {})}

      if (sub === "deactivate") {
        updated.status = "inactive"
      }

      if (sub === "reactivate") {
        updated.status = "active"
      }

      relays.set(id, updated)

      return route.fulfill({json: {data: updated}})
    }

    if (resource === "invoices") {
      const invoice = invoices.get(id)

      if (!invoice) {
        return missing(`invoice ${id}`)
      }

      if (sub === "items") {
        return route.fulfill({json: {data: invoice.items ?? []}})
      }

      if (sub === "bolt11") {
        const bolt11 = invoice.bolt11 ?? {
          id: `bolt11-${id}`,
          invoice_id: id,
          lnbc: `lnbc${id}`,
          msats: 0,
          created_at: now(),
          expires_at: now() + int(1, HOUR),
        }

        return route.fulfill({json: {data: bolt11}})
      }

      if (sub === "checkout") {
        return route.fulfill({json: {data: {url: `${CHECKOUT_ORIGIN}/invoices/${id}`}}})
      }

      // GET and reconcile both answer with the invoice as it stands, which is how a spec marks one paid.
      return route.fulfill({json: {data: invoice}})
    }

    return route.fallback()
  })

  return handle
}

export type LivekitOptions = {
  // Point it at something the test owns, since the token this hands out is accepted by nothing else.
  serverUrl: string
  token?: string
}

export const mockLivekit = (context: BrowserContext, {serverUrl, token}: LivekitOptions) =>
  context.route(
    url => url.pathname.startsWith(LIVEKIT_PATH),
    route => {
      const roomId = new URL(route.request().url()).pathname.slice(LIVEKIT_PATH.length + 1)

      if (roomId) {
        return route.fulfill({
          json: {server_url: serverUrl, participant_token: token ?? "test-participant-token"},
        })
      }

      // The support probe in src/lib/livekit.ts reads support off the status alone.
      return route.fulfill({status: 204, body: ""})
    },
  )

/** Serves a png for anything loaded as an image, so a fixture's avatar and blob urls are never fetched. */
export const mockImages = (context: BrowserContext) =>
  context.route(
    url => !isDevServerUrl(url),
    route => {
      if (route.request().resourceType() === "image") {
        return route.fulfill({contentType: "image/png", body: PNG})
      }

      return route.fallback()
    },
  )
