import {sortBy, ms} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"

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

export type UpdateRelayInput = Partial<
  Pick<
    HostedRelay,
    | "subdomain"
    | "zooid_domain"
    | "plan_id"
    | "info_name"
    | "info_icon"
    | "info_description"
    | "custom_domain"
    | RelayFlag
  >
>

export type CreateRelayInput = UpdateRelayInput &
  Pick<HostedRelay, "tenant_pubkey" | "subdomain" | "zooid_domain" | "plan_id">

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

// What a new relay starts with, and what a toggle shows when the backend leaves a flag unset.
export const RELAY_FLAG_DEFAULTS: Pick<HostedRelay, RelayFlag> = {
  policy_public_read: 0,
  policy_public_write: 0,
  policy_public_join: 0,
  policy_strip_signatures: 0,
  groups_enabled: 1,
  management_enabled: 1,
  members_can_invite: 1,
  blossom_enabled: 0,
  livekit_enabled: 0,
  push_enabled: 1,
}

// Paid plans are the ones that bill, and the only ones with media storage and livekit.
export const isPaidPlan = (planId: string) => planId !== "free"

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
