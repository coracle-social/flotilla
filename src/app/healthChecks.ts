import {derived, get, writable} from "svelte/store"
import {assoc, sample} from "@welshman/lib"
import {
  MessagingRelayLists,
  RelayLists,
  Relays,
  SearchRelayLists,
  projection,
  publish,
} from "@welshman/app"
import type {IApp, Projection} from "@welshman/app"
import KeyDownload from "@app/components/KeyDownload.svelte"
import {session, usePlugin} from "@app/core"
import {DEFAULT_RELAYS, DEFAULT_MESSAGING_RELAYS} from "@app/env"
import {pushModal} from "@app/modal"

export type HealthCheckContext = {
  readRelays: string[]
  writeRelays: string[]
  messagingRelays: string[]
  searchRelays: string[]
}

export type HealthCheck = {
  id: string
  title: string
  description: string
  action: string
  isPending: (context: HealthCheckContext) => boolean
  apply: (context: HealthCheckContext) => unknown
}

export const forceHealthChecks = writable<Record<string, boolean>>({})

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
      derived([this.context.$, forceHealthChecks], ([$context, $forceHealthChecks]) =>
        this.checks.filter(check => $forceHealthChecks[check.id] ?? check.isPending($context)),
      ),
    )
  }

  private supportsSearch = (url: string) => this.app.use(Relays).get(url)?.hasNip(50)

  private checks: HealthCheck[] = [
    {
      id: "missing-inbox-relays",
      title: "Missing Inbox Relays",
      description: "Other people aren't currently able to reliably tag you in public notes.",
      action: "Update",
      isPending: context => context.readRelays.length <= 1,
      apply: () => this.app.use(RelayLists).setReadUrls(DEFAULT_RELAYS).then(publish),
    },
    {
      id: "missing-outbox-relays",
      title: "Missing Outbox Relays",
      description: "Other people aren't currently able to reliably find your public notes.",
      action: "Update",
      isPending: context => context.writeRelays.length <= 1,
      apply: () => this.app.use(RelayLists).setWriteUrls(DEFAULT_RELAYS).then(publish),
    },
    {
      id: "missing-dm-relays",
      title: "Missing DM Relays",
      description: "You aren't currently able to reliably send or receive direct messages.",
      action: "Update",
      isPending: context => context.messagingRelays.length <= 1,
      apply: () =>
        this.app.use(MessagingRelayLists).setUrls(DEFAULT_MESSAGING_RELAYS).then(publish),
    },
    {
      id: "too-many-inbox-relays",
      title: "Too Many Inbox Relays",
      description:
        "You have more inbox relays than is really necessary, which can affect resource usage.",
      action: "Prune Selections",
      isPending: context => context.readRelays.length > 8,
      apply: context =>
        this.app.use(RelayLists).setReadUrls(sample(5, context.readRelays)).then(publish),
    },
    {
      id: "too-many-outbox-relays",
      title: "Too Many Outbox Relays",
      description:
        "You have more outbox relays than is really necessary, which can affect resource usage.",
      action: "Prune Selections",
      isPending: context => context.writeRelays.length > 8,
      apply: context =>
        this.app.use(RelayLists).setWriteUrls(sample(5, context.writeRelays)).then(publish),
    },
    {
      id: "too-many-dm-relays",
      title: "Too Many DM Relays",
      description:
        "You have more DM relays than is really necessary, which can affect resource usage.",
      action: "Prune Selections",
      isPending: context => context.messagingRelays.length > 8,
      apply: context =>
        this.app.use(MessagingRelayLists).setUrls(sample(5, context.messagingRelays)).then(publish),
    },
    {
      id: "invalid-search-relays",
      title: "Invalid Search Relays",
      description: "Some of your search relays don't support search.",
      action: "Remove Invalid",
      isPending: context => context.searchRelays.some(url => !this.supportsSearch(url)),
      apply: context =>
        this.app
          .use(SearchRelayLists)
          .setUrls(context.searchRelays.filter(this.supportsSearch))
          .then(publish),
    },
    {
      id: "backup-key",
      title: "Back Up Your Key",
      description: "Save a backup of your private key in a secure place.",
      action: "Back Up",
      isPending: () => false,
      apply: () => {
        const {secret} = session.get()!.data as {secret: string}

        pushModal(KeyDownload, {
          secret,
          next: () => {
            forceHealthChecks.update(assoc("backup-key", false))
            history.back()
          },
          submitText: "Done",
        })
      },
    },
  ]

  isPending = (healthCheck: HealthCheck) =>
    get(forceHealthChecks)[healthCheck.id] ?? healthCheck.isPending(this.context.get())

  apply = (healthCheck: HealthCheck) => healthCheck.apply(this.context.get())
}

export const healthChecks = usePlugin(HealthChecks)
