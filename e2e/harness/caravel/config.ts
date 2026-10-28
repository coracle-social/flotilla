import type {TenantName} from "../relay/config"

// The relay settings caravel's api takes, as booleans, which it accepts in place of 0 and 1.
export type RelaySettings = {
  info_name: string
  info_description: string
  policy_public_read: boolean
  policy_anonymous_read: boolean
  policy_public_write: boolean
  policy_public_join: boolean
  policy_strip_signatures: boolean
  groups_enabled: boolean
  management_enabled: boolean
  members_can_invite: boolean
  blossom_enabled: boolean
  livekit_enabled: boolean
  push_enabled: boolean
}

// Each tenant's toml in zooid/docker/config, said in caravel's terms. Every space starts from this one.
const space: RelaySettings = {
  info_name: "space",
  info_description: "Throwaway relay for Flotilla's end-to-end suite.",
  policy_public_read: false,
  // zooid answers no REQ without nip-42, whatever public_read says.
  policy_anonymous_read: false,
  policy_public_write: false,
  policy_public_join: true,
  policy_strip_signatures: false,
  groups_enabled: true,
  management_enabled: true,
  // caravel's default hands every member the claim methods, which no toml does.
  members_can_invite: false,
  blossom_enabled: false,
  livekit_enabled: false,
  push_enabled: false,
}

const open: RelaySettings = {
  ...space,
  policy_public_read: true,
  policy_public_write: true,
  policy_public_join: false,
  groups_enabled: false,
  management_enabled: false,
}

export const relaySettings: Record<TenantName, RelaySettings> = {
  space,
  other: {...space, info_name: "other"},
  closed: {...space, info_name: "closed", policy_public_join: false},
  unsigned: {...space, info_name: "unsigned", policy_strip_signatures: true},
  delegated: {...space, info_name: "delegated"},
  indexer: {...open, info_name: "indexer"},
  outbox: {...open, info_name: "outbox"},
}

// zooid's member_methods. caravel grants a method to one pubkey at a time, so each is granted on joining.
export const memberMethods: Partial<Record<TenantName, string[]>> = {
  delegated: ["allowpubkey"],
}
