// The virtual relays the container serves. .test is reserved by rfc 2606, so none of them resolve.

// The relays a space is seeded on: members-only, with nip-29 groups on.
export const spaceTenants = {
  space: "space.test",
  other: "other.test",
  // Policy space.toml cannot express at the same time: no invite, stripped signatures, delegated management.
  closed: "closed.test",
  unsigned: "unsigned.test",
  delegated: "delegated.test",
} as const

// Public relays with no groups, where anything outside a space lives. See ARCHITECTURE.md, "The follow graph".
export const openTenants = {
  indexer: "indexer.test",
  outbox: "outbox.test",
} as const

export const tenants = {...spaceTenants, ...openTenants} as const

export type SpaceName = keyof typeof spaceTenants

export type OpenRelayName = keyof typeof openTenants

export type TenantName = keyof typeof tenants

export const tenantUrl = (name: TenantName) => `wss://${tenants[name]}/`

export const tenantNames = Object.keys(tenants) as TenantName[]

// Which tenant a url belongs to, for the transport's Host header.
export const tenantByUrl = new Map(tenantNames.map(name => [tenantUrl(name), tenants[name]]))
