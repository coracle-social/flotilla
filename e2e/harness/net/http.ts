import {createHash} from "node:crypto"
import type {BrowserContext} from "@playwright/test"
import {HOUR, int, now, omit} from "@welshman/lib"
import type {Handle} from "@welshman/util"
import type {ZapperValues} from "@welshman/domain"
import {tenantByUrl} from "../zooid/config"
import {requestZooid} from "../zooid/transport"
import {makeContextStore} from "./context"

// Mirrors the service urls in src/app/env.ts and .env, which this process can't import because
// env.ts reads import.meta.env and pulls in Capacitor. These are route patterns rather than urls
// anything fetches, and every handler answers from memory.
const DUFFLEPUD_ORIGIN = "https://dufflepud.coracle.social"
const PUSH_SERVER_ORIGIN = "https://nps.flotilla.social"
const HOSTING_ORIGIN = "https://api.hosting.coracle.social"

// Hard-coded in src/app.html, so every navigation asks for it whatever the scenario is doing.
const PLAUSIBLE_ORIGIN = "https://plausible.coracle.social"

// Transcription and speech both go here, against whichever key the user has saved.
const OPENROUTER_ORIGIN = "https://openrouter.ai"

// Where the hosting api sends a browser to pay. `.test` resolves nowhere and the block-all aborts
// the navigation, so a spec sees the redirect without one leaving.
const CHECKOUT_ORIGIN = "https://checkout.test"

// Relay-hosted livekit lives under a well-known path rather than an origin of its own.
const LIVEKIT_PATH = "/.well-known/nip29/livekit"

// A 1x1 transparent png, small enough to inline and real enough for an <img> to decode.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=",
  "base64",
)

// The dev server from vite.config.ts, on the port playwright.config.ts started it on. Traffic to it
// is the app loading itself rather than egress, so it is the one host both layers here let past,
// websockets included for Vite's hmr socket.
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

/**
 * Blocks every http request the app makes, except to the dev server and to a relay's own origin,
 * which is forwarded to the container so that the nip-11 document and the nip-86 management api the
 * app reads are the real relay's. Install this first. The per-service mocks below are registered
 * later and therefore take priority, so a request that still reaches this handler is one nothing
 * has mocked.
 */
export const installHttpRoutes = (context: BrowserContext) => {
  const blocked = blockedStore.set(context, [])

  // The dev server is left unrouted rather than matched and continued. A sveltekit page in dev is
  // hundreds of module requests, and none of them is egress.
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

/**
 * Opt-in, for a spec that wants every request the app made to have been answered by something the
 * scenario stood up. Some of what a page asks for is meant to be refused, such as the blossom probe
 * against a relay with blossom off, so call this from a spec that has mocked what it exercises
 * rather than from teardown.
 */
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

/**
 * A relay's real document with a few fields replaced, such as a `redirect_to`, a `limitation`, or a
 * NIP the relay does not implement. It is merged rather than fabricated because `self`, `pubkey`,
 * `name` and `supported_nips` are what room state is trusted from, and a hand-written document
 * breaks every room on the page.
 *
 * Install it before the page navigates. The document is read at startup and cached from then on.
 */
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

      // The nip-86 management api posts to this same path, and what it answers decides what the
      // admin ui offers, so only the document request is touched.
      if (request.method() === "GET" && host && override) {
        const {status, headers, body} = await requestZooid(host, "GET", "/", {
          ...request.headers(),
          // The merge has to read the document, and khatru compresses it when invited to.
          "accept-encoding": "identity",
        })

        return route.fulfill({
          status,
          // khatru's Access-Control-Allow-Origin is what makes the fetch legal, so the relay's own
          // headers are kept, all but the length of a body that is about to change.
          headers: omit(["content-length"], headers),
          body: JSON.stringify({...JSON.parse(body.toString()), ...override}),
        })
      }

      return route.fallback()
    },
  )
}

/**
 * The analytics script src/app.html loads on every page. Answering with an empty body leaves
 * `window.plausible` as the queueing shim src/app/analytics.ts installs, so pageviews accumulate in
 * memory and nothing is ever sent.
 */
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

/**
 * Dufflepud, whose origin is the one service url the app hard-codes rather than reading from a
 * `VITE_` value. `as()` installs it with no fixtures, so a spec that needs one calls this again
 * with its own. Playwright matches the most recently registered route first, so the spec's answers
 * win over the empty defaults.
 */
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

// The rate the endpoint documents for raw pcm, at 16 bits a sample, which is what the app assumes
// when it writes a wav header for one.
const SPEECH_RATE = 24000

// Headerless silence. Nothing in it says how long it is, so the duration a spec reads off the
// player is the one the app computed.
const silence = (seconds: number) => Buffer.alloc(seconds * SPEECH_RATE * 2)

// mp3 is the other format the real endpoint encodes, and the harness has no encoder for it, so
// asking for one here is a mistake rather than a case to serve.
const SPEECH_FORMAT = "pcm"

/**
 * OpenRouter's text to speech, answering every request with the same silence. The array it returns
 * collects what the app asked to have read, in the order it asked. Answering a decodable wav to a
 * request for some other format would prove nothing about the container the app builds, so anything
 * but raw pcm is refused.
 */
export const mockOpenRouterSpeech = async (context: BrowserContext, seconds = 3) => {
  const spoken: string[] = []

  await context.route(`${OPENROUTER_ORIGIN}/api/v1/audio/speech`, route => {
    const {input, response_format} = JSON.parse(route.request().postData() ?? "{}")

    if (response_format === SPEECH_FORMAT) {
      spoken.push(input)

      return route.fulfill({
        contentType: `audio/pcm;rate=${SPEECH_RATE};channels=1`,
        body: silence(seconds),
      })
    }

    return route.fulfill({
      status: 400,
      json: {error: {message: `Invalid option: expected ${SPEECH_FORMAT}`}},
    })
  })

  return spoken
}

export type BlossomOptions = {
  // The blossom server the scenario expects an upload to land on, e.g. a space's own url.
  server: string
}

/**
 * What a spec can turn on. Each of these is off by default, so a scenario that only needs somewhere
 * for an upload to land ignores all of it.
 */
export type BlossomHandle = {
  // The same server, blobs included, in another user's context. A conversation's image is uploaded
  // encrypted and decrypted by the recipient, so the bytes one end puts in have to be the bytes the
  // other reads back.
  install(context: BrowserContext): Promise<void>
  // Holds every upload open until `release`, which makes the in-flight state a fact rather than a
  // race against a mock that answers in a microtask.
  hold(): void
  release(): void
  // Refuses every upload probe from here on, with a reason the app has to show.
  refuse(reason: string): void
}

/**
 * A blossom server that keeps what it was given. An upload is hashed exactly as the real thing
 * would be, so the descriptor it answers with points at a blob this mock can then serve back.
 */
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
          // BUD-06, which the app asks before spending an upload. A refusal has to expose its
          // reason cross-origin or all the toast can say is the status code.
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

/**
 * The push server from src/app/push/adapters/capacitor.ts. Only the native adapters talk to it,
 * so a browser run reaches this only if the platform detection regresses.
 */
export const mockPushServer = (context: BrowserContext) =>
  context.route(`${PUSH_SERVER_ORIGIN}/**`, route => {
    const [resource] = new URL(route.request().url()).pathname.split("/").filter(Boolean)

    if (resource === "subscription") {
      if (route.request().method() === "DELETE") {
        return route.fulfill({json: {}})
      }

      // Registration is only usable if it comes back with both. The relay is told to post
      // notifications to the callback rather than the client ever fetching it.
      const key = "test-push-subscription"

      return route.fulfill({json: {key, callback: `${PUSH_SERVER_ORIGIN}/callback/${key}`}})
    }

    return route.fallback()
  })

// One record straight off the hosting api, whose shapes live in src/app/hosting.ts. They're left
// as loose objects here so that mocking a payment flow doesn't pull the app's module graph, and
// with it import.meta.env, into the node process. A relay record may also carry `members` and
// `activity`, and an invoice `items` and `bolt11`, which is where those endpoints answer from.
export type HostingRecord = Record<string, unknown>

// The backend's state when the page opens. Everything after that is what the app wrote, plus
// whatever the handle below changed.
export type HostingFixtures = {
  plans?: HostingRecord[]
  // Provisioning runs on every login and ignores what it gets back, so the empty default carries
  // any spec that isn't actually exercising the hosting ui.
  tenant?: HostingRecord
  relays?: HostingRecord[]
  invoices?: HostingRecord[]
  draftInvoice?: HostingRecord
}

// The backend changing its mind between two of the user's clicks, such as a custom domain that
// verifies or an invoice that gets paid. It is the half of those flows no click can reach.
export type HostingHandle = {
  setTenant(patch: HostingRecord): void
  setRelay(id: string, patch: HostingRecord): void
  setInvoice(id: string, patch: HostingRecord): void
}

const hostingStore = makeContextStore<HostingHandle>("mockHosting")

export const getHosting = (context: BrowserContext) => hostingStore.get(context)

/**
 * The hosting api as a small stateful fake. A write mutates the record it names and the next read
 * sees it, which is what makes editing a space's details, deactivating it, changing its plan or
 * saving a custom domain observable. Each browser context gets its own store, so one user's spaces
 * are not another's.
 */
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
    const body: HostingRecord = request.postDataJSON() ?? {}
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
          // A created space is opened straight away, so its url has to be one the container
          // serves. The client names the domain from VITE_HOSTING_RELAY_DOMAIN.
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

      // GET and reconcile both answer with the invoice as it now stands, which is how a spec marks
      // one paid. Flip `paid_at` with the handle and let the dialog's next poll find it.
      return route.fulfill({json: {data: invoice}})
    }

    return route.fallback()
  })

  return handle
}

export type LivekitOptions = {
  // Where the client is told to connect. Point it at something the test owns, since the token this
  // hands out is accepted by nothing else.
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

/**
 * Serves a png for anything the browser is loading as an image, so a scenario's fixtures can
 * reference avatar, banner, blob and poster urls without any of them being fetched.
 */
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
