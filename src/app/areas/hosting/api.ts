import {Capacitor} from "@capacitor/core"
import type {Maybe} from "@welshman/lib"
import {now} from "@welshman/lib"
import {makeHttpAuth, makeHttpAuthHeader} from "@welshman/util"
import {user} from "@app/core/user"
import {HOSTING_BACKEND_URL, HOSTING_RELAY_DOMAIN, PLATFORM_URL} from "@app/core/env"
import type {
  Activity,
  Bolt11,
  CreateRelayInput,
  HostedRelay,
  ImportResult,
  Invoice,
  InvoiceItem,
  Plan,
  Tenant,
  UpdateRelayInput,
  UpdateTenantInput,
} from "@app/areas/hosting/model"
import {boolToFlag, isPaidPlan, RELAY_FLAG_DEFAULTS} from "@app/areas/hosting/model"

export class HostingError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "HostingError"
    this.status = status
  }
}

export const logUnexpectedError = (e: unknown) => {
  if (!(e instanceof HostingError)) {
    console.error(e)
  }
}

// A HostingError carries the backend's own explanation; anything else is a bug worth logging.
export const hostingErrorMessage = (e: unknown, fallback: string) => {
  logUnexpectedError(e)

  return e instanceof HostingError ? e.message : fallback
}

type HostingResponse<T> = {data: T; error?: string}

// The backend mounts its API under a path, which `new URL` would throw away.
const hostingUrl = (path: string) => HOSTING_BACKEND_URL.replace(/\/$/, "") + path

const hostingJson = async <T>(response: Response): Promise<T> => {
  const payload: Maybe<HostingResponse<T>> = await response.json().catch(() => undefined)

  if (response.ok && payload) {
    return payload.data
  }

  throw new HostingError(payload?.error || `Request failed (${response.status})`, response.status)
}

// The backend trades a NIP-98 signature for a bearer token, which every other request carries.
let session: {pubkey: string; token: string; expiresAt: number} | undefined

const getSessionToken = async () => {
  const {pubkey, signer} = user.get()

  if (session?.pubkey === pubkey && session.expiresAt > now()) {
    return session.token
  }

  const url = hostingUrl("/session")
  const event = await signer.sign(await makeHttpAuth(url, "POST"))
  const {token, expires_at} = await hostingJson<{token: string; expires_at: number}>(
    await fetch(url, {
      method: "POST",
      headers: {Accept: "application/json", Authorization: makeHttpAuthHeader(event)},
    }),
  )

  session = {pubkey, token, expiresAt: expires_at}

  return token
}

const hostingRequest = async (method: string, path: string, init: RequestInit = {}) => {
  const send = async () =>
    fetch(hostingUrl(path), {
      ...init,
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${await getSessionToken()}`,
        ...init.headers,
      },
    })

  const response = await send()

  // A token the backend has forgotten is worth one more try.
  if (response.status === 401) {
    session = undefined

    return send()
  }

  return response
}

const hostingFetch = async <T>(method: string, path: string, body?: unknown): Promise<T> =>
  hostingJson<T>(
    await hostingRequest(method, path, {
      headers: body === undefined ? undefined : {"Content-Type": "application/json"},
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )

// On native, a redirect can't round-trip through location.origin.
const hostingReturnUrl = (path = "/settings/hosting"): string =>
  Capacitor.isNativePlatform() ? PLATFORM_URL + path : location.origin + path

export const listPlans = () => hostingFetch<Plan[]>("GET", "/plans")

const createTenant = (returnUrl: string) =>
  hostingFetch<Tenant>("POST", "/tenants", {return_url: returnUrl})

export const getTenant = (pubkey: string) => hostingFetch<Tenant>("GET", `/tenants/${pubkey}`)

export const updateTenant = (pubkey: string, input: UpdateTenantInput) =>
  hostingFetch<Tenant>("PUT", `/tenants/${pubkey}`, input)

export const listTenantRelays = (pubkey: string) =>
  hostingFetch<HostedRelay[]>("GET", `/tenants/${pubkey}/relays`)

export const listTenantInvoices = (pubkey: string) =>
  hostingFetch<Invoice[]>("GET", `/tenants/${pubkey}/invoices`)

export const reconcileTenant = (pubkey: string) =>
  hostingFetch<Tenant>("POST", `/tenants/${pubkey}/reconcile`)

// The backend answers with null when nothing has accrued this period.
export const getDraftInvoice = async (pubkey: string): Promise<Maybe<Invoice>> =>
  (await hostingFetch<Invoice | null>("GET", `/tenants/${pubkey}/invoices/draft`)) ?? undefined

export const createPortalSession = (pubkey: string, returnUrl: string = hostingReturnUrl()) =>
  hostingFetch<{url: string}>(
    "GET",
    `/tenants/${pubkey}/stripe/session?return_url=${encodeURIComponent(returnUrl)}`,
  )

const createRelay = (input: CreateRelayInput) => hostingFetch<HostedRelay>("POST", "/relays", input)

export const getRelay = (id: string) => hostingFetch<HostedRelay>("GET", `/relays/${id}`)

export const updateRelay = (id: string, input: UpdateRelayInput) =>
  hostingFetch<HostedRelay>("PUT", `/relays/${id}`, input)

export const deactivateRelay = (id: string) =>
  hostingFetch<void>("POST", `/relays/${id}/deactivate`)

export const reactivateRelay = (id: string) =>
  hostingFetch<void>("POST", `/relays/${id}/reactivate`)

export const listRelayMembers = (id: string) =>
  hostingFetch<{members: string[]}>("GET", `/relays/${id}/members`)

export const listRelayActivity = (id: string) =>
  hostingFetch<{activity: Activity[]}>("GET", `/relays/${id}/activity`)

// Fetched rather than linked, since the nip 98 auth header can't ride on an <a href>.
export const exportRelayData = async (id: string) => {
  const response = await hostingRequest("GET", `/relays/${id}/export`)

  if (response.ok) {
    return response.text()
  }

  // Only the failure path is a json envelope; success is the dump itself.
  return hostingJson<string>(response)
}

// Events keep their own signatures, so the relay validates them and reports the lines it refused.
export const importRelayData = async (id: string, file: Blob) =>
  hostingJson<ImportResult>(
    await hostingRequest("POST", `/relays/${id}/import`, {
      headers: {"Content-Type": "application/x-ndjson"},
      body: file,
    }),
  )

export const getInvoice = (id: string) => hostingFetch<Invoice>("GET", `/invoices/${id}`)

export const listInvoiceItems = (invoiceId: string) =>
  hostingFetch<InvoiceItem[]>("GET", `/invoices/${invoiceId}/items`)

export const ensureInvoiceBolt11 = (invoiceId: string) =>
  hostingFetch<Bolt11>("POST", `/invoices/${invoiceId}/bolt11`)

export const createInvoiceCheckout = (invoiceId: string) => {
  const returnUrl = hostingReturnUrl()
  const queryString = `?return_url=${encodeURIComponent(returnUrl)}`

  return hostingFetch<{url: string}>("POST", `/invoices/${invoiceId}/checkout${queryString}`)
}

export const reconcileInvoice = (invoiceId: string) =>
  hostingFetch<Invoice>("POST", `/invoices/${invoiceId}/reconcile`)

// Provisioning is idempotent, and the shared promise dedupes concurrent callers.
let tenantPromise: Maybe<{pubkey: string; promise: Promise<Tenant>}>

export const ensureSessionTenant = async () => {
  const $pubkey = user.get().pubkey

  if (tenantPromise?.pubkey !== $pubkey) {
    const promise = createTenant(hostingReturnUrl())

    promise.catch(() => {
      if (tenantPromise?.promise === promise) {
        tenantPromise = undefined
      }
    })

    tenantPromise = {pubkey: $pubkey, promise}
  }

  await tenantPromise.promise
}

export const createHostedRelay = async (
  values: Omit<CreateRelayInput, "tenant_pubkey" | "zooid_domain">,
) => {
  await ensureSessionTenant()

  const features = boolToFlag(isPaidPlan(values.plan_id))

  return createRelay({
    ...RELAY_FLAG_DEFAULTS,
    ...values,
    tenant_pubkey: user.get().pubkey,
    zooid_domain: HOSTING_RELAY_DOMAIN,
    blossom_enabled: features,
    livekit_enabled: features,
  })
}
