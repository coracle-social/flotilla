import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import {Capacitor} from "@capacitor/core"
import type {Maybe} from "@welshman/lib"
import {sortBy, int, MINUTE, ms} from "@welshman/lib"
import {makeHttpAuth, makeHttpAuthHeader, normalizeRelayUrl} from "@welshman/util"
import {user} from "@app/core"
import {HOSTING_BACKEND_URL, PLATFORM_URL} from "@app/env"

// Apple doesn't allow selling hosting outside their payment system.
export const HOSTING_ENABLED = Capacitor.getPlatform() !== "ios"

export type Plan = {
  id: string
  name: string
  amount: number
  hidden: boolean
  members: number | null
  blossom: boolean
  livekit: boolean
}

export type HostedRelay = {
  id: string
  tenant_pubkey: string
  subdomain: string
  zooid_domain: string
  plan_id: string
  status: string
  sync_error: string
  synced: number
  custom_domain: string
  custom_domain_verified: number
  info_name: string
  info_icon: string
  info_description: string
  policy_public_read: number
  policy_public_write: number
  policy_public_join: number
  policy_strip_signatures: number
  groups_enabled: number
  management_enabled: number
  members_can_invite: number
  blossom_enabled: number
  livekit_enabled: number
  push_enabled: number
}

// The relay's boolean settings, which the backend models as 0/1 columns.
export type RelayFlag =
  | "policy_public_read"
  | "policy_public_write"
  | "policy_public_join"
  | "policy_strip_signatures"
  | "groups_enabled"
  | "management_enabled"
  | "members_can_invite"
  | "blossom_enabled"
  | "livekit_enabled"
  | "push_enabled"

export type CreateRelayInput = {
  tenant_pubkey?: string
  subdomain: string
  zooid_domain: string
  plan_id: string
  info_name?: string
  info_icon?: string
  info_description?: string
  policy_public_read?: number
  policy_public_write?: number
  policy_public_join?: number
  policy_strip_signatures?: number
  groups_enabled?: number
  management_enabled?: number
  members_can_invite?: number
  blossom_enabled?: number
  livekit_enabled?: number
  push_enabled?: number
  custom_domain?: string
}

export type UpdateRelayInput = {
  subdomain?: string
  zooid_domain?: string
  plan_id?: string
  info_name?: string
  info_icon?: string
  info_description?: string
  policy_public_read?: number
  policy_public_write?: number
  policy_public_join?: number
  policy_strip_signatures?: number
  groups_enabled?: number
  management_enabled?: number
  members_can_invite?: number
  blossom_enabled?: number
  livekit_enabled?: number
  push_enabled?: number
  custom_domain?: string
}

export type Tenant = {
  pubkey: string
  return_url: string
  nwc_is_set: boolean
  created_at: number
  billing_anchor: number | null
  stripe_customer_id: string
  stripe_payment_method_id: string | null
  nwc_error: string | null
  stripe_error: string | null
  churned_at: number | null
}

export type UpdateTenantInput = {
  nwc_url?: string
}

export type InvoiceMethod = "nwc" | "stripe" | "oob"

export type Invoice = {
  id: string
  tenant_pubkey: string
  amount: number
  period_start: number
  period_end: number
  created_at: number
  paid_at: number | null
  voided_at: number | null
  method: InvoiceMethod | null
}

export type InvoiceItem = {
  id: string
  invoice_id: string | null
  activity_id: string | null
  tenant_pubkey: string
  relay_id: string
  plan_id: string
  amount: number
  description: string
  created_at: number
  voided_at: number | null
}

export type Bolt11 = {
  id: string
  invoice_id: string
  lnbc: string
  msats: number
  created_at: number
  expires_at: number
  settled_at: number | null
}

export type Activity = {
  id: string
  tenant_pubkey: string
  created_at: number
  activity_type: string
  resource_type: string
  resource_id: string
}

// One line of an imported JSONL file the relay could not store.
export type ImportProblem = {
  line: number
  event_id: string
  message: string
}

export type ImportResult = {
  imported: number
  invalid: number
  problems?: ImportProblem[]
}

export class HostingError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "HostingError"
    this.status = status
  }
}

// Requests

const AUTH_TTL = ms(int(10, MINUTE))

// The backend checks the signature and `u` tag but not freshness, so one token per pubkey is reusable.
let cachedAuth: Maybe<{pubkey: string; expiresAt: number; header: Promise<string>}>

const getAuthHeader = (): Promise<string> => {
  const {pubkey, signer} = user.get()

  if (cachedAuth?.pubkey !== pubkey || cachedAuth.expiresAt < Date.now()) {
    const header = makeHttpAuth(HOSTING_BACKEND_URL, "GET")
      .then(template => signer.sign(template))
      .then(makeHttpAuthHeader)

    // A declined signature shouldn't be cached, or the user can't retry.
    header.catch(() => {
      if (cachedAuth?.header === header) {
        cachedAuth = undefined
      }
    })

    cachedAuth = {pubkey, expiresAt: Date.now() + AUTH_TTL, header}
  }

  return cachedAuth.header
}

type HostingResponse<T> = {data: T; error?: string}

const hostingRequest = async (method: string, path: string, init: RequestInit = {}) =>
  fetch(new URL(path, HOSTING_BACKEND_URL).toString(), {
    ...init,
    method,
    headers: {
      Accept: "application/json",
      Authorization: await getAuthHeader(),
      ...init.headers,
    },
  })

const hostingJson = async <T>(response: Response): Promise<T> => {
  const payload: Maybe<HostingResponse<T>> = await response.json().catch(() => undefined)

  if (response.ok && payload) {
    return payload.data
  }

  throw new HostingError(payload?.error || `Request failed (${response.status})`, response.status)
}

export const hostingFetch = async <T>(method: string, path: string, body?: unknown): Promise<T> =>
  hostingJson<T>(
    await hostingRequest(method, path, {
      headers: body === undefined ? undefined : {"Content-Type": "application/json"},
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )

export const listPlans = () => hostingFetch<Plan[]>("GET", "/plans")

export const createTenant = (returnUrl: string) =>
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

export const createRelay = (input: CreateRelayInput) =>
  hostingFetch<HostedRelay>("POST", "/relays", input)

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

// API utils

export const flagToBool = (value: number | undefined, fallback: boolean): boolean => {
  if (value === 0) {
    return false
  }
  if (value === 1) {
    return true
  }
  return fallback
}

export const boolToFlag = (value: boolean): 0 | 1 => (value ? 1 : 0)

export const autopayConfigured = (
  t: Pick<Tenant, "nwc_is_set" | "stripe_payment_method_id">,
): boolean => t.nwc_is_set || Boolean(t.stripe_payment_method_id)

// The oldest open positive invoice, matching the backend's dunning order.
export const selectPayableInvoice = (invoices: Invoice[]): Invoice | undefined =>
  sortBy(invoice => invoice.created_at, invoices).find(
    invoice => !invoice.paid_at && !invoice.voided_at && invoice.amount > 0,
  )

export const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`

export const formatPeriod = (startSecs?: number, endSecs?: number) =>
  !startSecs || !endSecs
    ? ""
    : `${new Date(ms(startSecs)).toLocaleDateString()} – ${new Date(ms(endSecs)).toLocaleDateString()}`

// A verified custom domain when present, otherwise the platform subdomain.
export const relayHost = (relay: HostedRelay): string =>
  relay.custom_domain_verified && relay.custom_domain
    ? relay.custom_domain
    : canonicalRelayHost(relay)

// The host a custom domain's DNS record must point at.
export const canonicalRelayHost = (relay: HostedRelay): string =>
  `${relay.subdomain}.${relay.zooid_domain}`

export const getHostedRelayUrl = (relay: HostedRelay): string =>
  normalizeRelayUrl("wss://" + relayHost(relay))

// On native, a redirect can't round-trip through location.origin.
export const hostingReturnUrl = (path = "/settings/hosting"): string =>
  Capacitor.isNativePlatform() ? PLATFORM_URL + path : location.origin + path

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

// Stores

export const derivePlans = () =>
  readable<Plan[]>([], set => {
    listPlans().then(set, () => set([]))
  })

export const deriveRelayMembers = (id: string) =>
  readable<string[]>([], set => {
    listRelayMembers(id).then(
      ({members}) => set(members),
      () => set([]),
    )
  })

export type RelayActivityState = {loading: boolean; activity: Activity[]}

// The id comes from the hosted relay lookup, which hasn't resolved when the page mounts.
export const deriveRelayActivity = (id: Readable<Maybe<string>>) =>
  derived<Readable<Maybe<string>>, RelayActivityState>(
    id,
    ($id, set) => {
      if (!$id) {
        return set({loading: false, activity: []})
      }

      set({loading: true, activity: []})

      listRelayActivity($id).then(
        ({activity}) => set({loading: false, activity}),
        () => set({loading: false, activity: []}),
      )
    },
    {loading: false, activity: []},
  )

// Loading and "not hosted here" both leave `relay` undefined, and only one keeps the caller waiting.
export type HostedRelayState = {loading: boolean; relay: Maybe<HostedRelay>}

export const deriveHostedRelay = (url: string) =>
  derived<typeof user, HostedRelayState>(
    user,
    ($user, set) => {
      set({loading: true, relay: undefined})

      listTenantRelays($user.pubkey).then(
        relays => set({loading: false, relay: relays.find(r => getHostedRelayUrl(r) === url)}),
        () => set({loading: false, relay: undefined}),
      )
    },
    {loading: true, relay: undefined},
  )
