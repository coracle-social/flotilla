import {derived} from "svelte/store"
import {assoc, sample} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import {projection, synced} from "@welshman/store"
import type {Projection} from "@welshman/store"
import {MessagingRelayLists, RelayLists, Relays, SearchRelayLists} from "@welshman/app"
import type {Command, IApp} from "@welshman/app"
import {usePlugin} from "@app/core/plugins"
import {session} from "@app/core/session"
import {DEFAULT_RELAYS} from "@app/core/env"
import {kv} from "@app/core/storage"
import {pushModal} from "@app/ui/modal"
import KeyDownload from "@app/components/KeyDownload.svelte"

export type HealthCheckContext = {
  readRelays: string[]
  writeRelays: string[]
  messagingRelays: string[]
  searchRelays: string[]
}

export type HealthCheckChange = {
  label: string
  added: string[]
  removed: string[]
}

// A plan with changes is reviewed and returns the Command to publish; one without does the fix itself.
export type HealthCheckPlan = {
  summary: string
  changes: HealthCheckChange[]
  apply: () => Promise<Command | void>
}

export type HealthCheck = {
  id: string
  title: string
  description: string
  isPending: (context: HealthCheckContext) => boolean
  plan: (context: HealthCheckContext) => HealthCheckPlan
}

type RelayListSpec = {
  id: string
  name: string
  noun: string
  // Only lists this app can fill from its own recommendations get a missing-relays check.
  missing?: {description: string; recommended: string[]}
  urls: (context: HealthCheckContext) => string[]
  save: (urls: string[]) => Promise<Command>
}

const relayPlan = (
  summary: string,
  label: string,
  current: string[],
  next: string[],
  save: (urls: string[]) => Promise<Command>,
): HealthCheckPlan => {
  const currentUrls = current.map(normalizeRelayUrl)
  const nextUrls = next.map(normalizeRelayUrl)
  const added = nextUrls.filter(url => !currentUrls.includes(url))
  const removed = currentUrls.filter(url => !nextUrls.includes(url))
  const changes = added.length + removed.length > 0 ? [{label, added, removed}] : []

  return {summary, changes, apply: () => save(nextUrls)}
}

const missingRelaysCheck = (
  spec: RelayListSpec,
  {description, recommended}: NonNullable<RelayListSpec["missing"]>,
): HealthCheck => ({
  id: `missing-${spec.id}-relays`,
  title: `Missing ${spec.name} Relays`,
  description,
  isPending: context => spec.urls(context).length <= 1,
  plan: context =>
    relayPlan(
      `Sets your ${spec.noun} relays to the ones this app recommends.`,
      `${spec.name} relays`,
      spec.urls(context),
      recommended,
      spec.save,
    ),
})

const tooManyRelaysCheck = (spec: RelayListSpec): HealthCheck => ({
  id: `too-many-${spec.id}-relays`,
  title: `Too Many ${spec.name} Relays`,
  description: `You have more ${spec.noun} relays than is really necessary, which can affect resource usage.`,
  isPending: context => spec.urls(context).length > 8,
  plan: context =>
    relayPlan(
      `Keeps five of your ${spec.noun} relays and drops the rest.`,
      `${spec.name} relays`,
      spec.urls(context),
      sample(5, spec.urls(context)),
      spec.save,
    ),
})

// Raises or clears a check by id regardless of what its own isPending says.
export const forceHealthChecks = synced<Record<string, boolean>>({
  key: "forceHealthChecks",
  storage: kv,
  defaultValue: {},
})

export class HealthChecks {
  context: Projection<HealthCheckContext>
  pending: Projection<HealthCheck[]>

  constructor(private readonly app: IApp) {
    const pubkey = app.user?.pubkey ?? ""

    this.context = projection(
      derived(
        [
          app.use(RelayLists).index.$,
          app.use(SearchRelayLists).index.$,
          app.use(MessagingRelayLists).index.$,
        ],
        ([$relayLists, $searchRelayLists, $messagingRelayLists]) => {
          const relayList = $relayLists.get(pubkey)

          return {
            readRelays: relayList?.readUrls() ?? [],
            writeRelays: relayList?.writeUrls() ?? [],
            searchRelays: $searchRelayLists.get(pubkey)?.urls() ?? [],
            messagingRelays: $messagingRelayLists.get(pubkey)?.urls() ?? [],
          }
        },
      ),
    )

    this.pending = projection(
      derived(
        [this.context.$, forceHealthChecks, app.use(Relays).index.$],
        ([$context, $forceHealthChecks]) =>
          this.checks.filter(check => $forceHealthChecks[check.id] ?? check.isPending($context)),
      ),
    )
  }

  private supportsSearch = (url: string) => this.app.use(Relays).get(url)?.hasNip(50) ?? true

  private relayLists: RelayListSpec[] = [
    {
      id: "inbox",
      name: "Inbox",
      noun: "inbox",
      missing: {
        description: "Other people aren't currently able to reliably tag you in public notes.",
        recommended: DEFAULT_RELAYS,
      },
      urls: context => context.readRelays,
      save: urls => this.app.use(RelayLists).setReadUrls(urls),
    },
    {
      id: "outbox",
      name: "Outbox",
      noun: "outbox",
      missing: {
        description: "Other people aren't currently able to reliably find your public notes.",
        recommended: DEFAULT_RELAYS,
      },
      urls: context => context.writeRelays,
      save: urls => this.app.use(RelayLists).setWriteUrls(urls),
    },
    {
      id: "dm",
      name: "DM",
      noun: "DM",
      urls: context => context.messagingRelays,
      save: urls => this.app.use(MessagingRelayLists).setUrls(urls),
    },
  ]

  private checks: HealthCheck[] = [
    ...this.relayLists.flatMap(spec =>
      spec.missing ? [missingRelaysCheck(spec, spec.missing)] : [],
    ),
    ...this.relayLists.map(tooManyRelaysCheck),
    {
      id: "invalid-search-relays",
      title: "Invalid Search Relays",
      description: "Some of your search relays don't support search.",
      isPending: context => context.searchRelays.some(url => !this.supportsSearch(url)),
      plan: context =>
        relayPlan(
          "Drops the search relays that don't support search.",
          "Search relays",
          context.searchRelays,
          context.searchRelays.filter(this.supportsSearch),
          urls => this.app.use(SearchRelayLists).setUrls(urls),
        ),
    },
    {
      id: "backup-key",
      title: "Back Up Your Key",
      description: "Save a backup of your private key in a secure place.",
      // Only a key generated in-app is ours to back up, so signup raises this through forceHealthChecks.
      isPending: () => false,
      plan: () => ({
        summary: "Opens the key backup dialog, where you choose how to save your key.",
        changes: [],
        apply: async () => {
          pushModal(KeyDownload, {
            secret: (session.get()!.data as {secret: string}).secret,
            next: this.finishKeyBackup,
            submitText: "Done",
          })
        },
      }),
    },
  ]

  private finishKeyBackup = () => {
    forceHealthChecks.update(assoc("backup-key", false))
    history.back()
  }

  plan = (healthCheck: HealthCheck) => healthCheck.plan(this.context.get())
}

export const healthChecks = usePlugin(HealthChecks)
