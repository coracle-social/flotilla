/**
 * The virtual relays the container serves, and the only place their names are written down.
 *
 * zooid binds a config to a Host header and serves any number of them from one process, so another
 * relay costs a toml in docker/config and nothing else. The names are a union rather than a string
 * so that a scenario naming a relay that has no config fails to compile instead of hanging on a 404
 * from the dispatcher.
 *
 * Each host resolves nowhere, and `.test` is reserved by rfc 2606, so a url that escapes this
 * process fails to connect rather than reaching a host. transport.ts covers why the container is
 * told to call itself this rather than its loopback address.
 */

// The relays a space is seeded on: members-only, with nip-29 groups on, which is what a Flotilla
// space is.
export const spaceTenants = {
  space: "space.test",
  other: "other.test",
  // Policy space.toml cannot express at the same time. `closed` refuses a join without an invite,
  // `unsigned` serves events with their signatures stripped.
  closed: "closed.test",
  unsigned: "unsigned.test",
} as const

// Public relays with no groups, which is where anything outside a space lives: `indexer` is what a
// pubkey's own lists are resolved from, `outbox` is a followed pubkey's write relay. See
// ARCHITECTURE.md, "The follow graph".
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
