import {Capacitor} from "@capacitor/core"
import * as nip19 from "nostr-tools/nip19"
import {identity} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import {maybeGetTestEnv} from "@lib/test/env"

const fromCsv = (s: string) => (s || "").split(",").filter(identity)

// Test-only: when Playwright has injected window.__TEST_ENV__, VITE_ values resolve against it, so
// each browser context can be pointed at the relays its own test created. Vite folds DEV to false
// in a production build, so the branch and the import are stripped from it.
const env = (key: string): string =>
  (import.meta.env.DEV ? maybeGetTestEnv(key) : undefined) ?? import.meta.env[key]

export const PUSH_SERVER = env("VITE_PUSH_SERVER")

export const PUSH_BRIDGE = normalizeRelayUrl(env("VITE_PUSH_BRIDGE"))

export const ENABLE_ZAPS = Capacitor.getPlatform() != "ios"

export const SIGNER_RELAYS = fromCsv(env("VITE_SIGNER_RELAYS")).map(normalizeRelayUrl)

export const BLOCKED_RELAYS = fromCsv(env("VITE_BLOCKED_RELAYS")).map(normalizeRelayUrl)

export const INDEXER_RELAYS = fromCsv(env("VITE_INDEXER_RELAYS")).map(normalizeRelayUrl)

export const DEFAULT_RELAYS = fromCsv(env("VITE_DEFAULT_RELAYS")).map(normalizeRelayUrl)

export const DEFAULT_SEARCH_RELAYS = fromCsv(env("VITE_DEFAULT_SEARCH_RELAYS")).map(
  normalizeRelayUrl,
)

export const DEFAULT_MESSAGING_RELAYS = fromCsv(env("VITE_DEFAULT_MESSAGING_RELAYS")).map(
  normalizeRelayUrl,
)

export const PLATFORM_RELAYS = fromCsv(env("VITE_PLATFORM_RELAYS")).map(normalizeRelayUrl)

export const PLATFORM_URL = env("VITE_PLATFORM_URL")

export const PLATFORM_ABOUT = env("VITE_PLATFORM_ABOUT")

export const PLATFORM_TERMS = env("VITE_PLATFORM_TERMS")

export const PLATFORM_PRIVACY = env("VITE_PLATFORM_PRIVACY")

export const PLATFORM_LOGO = env("VITE_PLATFORM_LOGO").replace(/^static/, "")

export const PLATFORM_NAME = env("VITE_PLATFORM_NAME")

export const PLATFORM_LOGEE = env("VITE_PLATFORM_LOGEE")

export const PLATFORM_ACCENT = env("VITE_PLATFORM_ACCENT")

// components visual preset (see src/lib/components/theme.css). Selected per
// deployment via VITE_THEME, which is assumed to be set to a known theme
// (e.g. "clay" or "flat") — there is no default.
export const FL_THEME = env("VITE_THEME")

export const PLATFORM_DESCRIPTION = env("VITE_PLATFORM_DESCRIPTION")

export const POMADE_SIGNERS = fromCsv(env("VITE_POMADE_SIGNERS"))

export const DEFAULT_BLOSSOM_SERVERS = fromCsv(env("VITE_DEFAULT_BLOSSOM_SERVERS"))

export const DEFAULT_SPACES = fromCsv(env("VITE_DEFAULT_SPACES")).map(normalizeRelayUrl)

export const DEFAULT_PUBKEYS = env("VITE_DEFAULT_PUBKEYS")

export const HOSTING_BACKEND_URL = env("VITE_HOSTING_BACKEND_URL")

export const HOSTING_RELAY_DOMAIN = env("VITE_HOSTING_RELAY_DOMAIN")

export const DUFFLEPUD_URL = "https://dufflepud.coracle.social"

export const THUMBNAIL_URL = env("VITE_THUMBNAIL_URL")

export const dufflepud = (path: string) => DUFFLEPUD_URL + "/" + path

export const entityLink = (entity: string) => `https://coracle.social/${entity}`

export const pubkeyLink = (pubkey: string, relays: string[] = []) =>
  entityLink(nip19.nprofileEncode({pubkey, relays}))
