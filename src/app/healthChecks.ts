import {derived, get, writable} from "svelte/store"
import {assoc, sample} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import {
  MessagingRelayLists,
  RelayLists,
  Relays,
  SearchRelayLists,
  projection,
  publish,
} from "@welshman/app"
import type {Command, IApp, Projection} from "@welshman/app"
import {errorMessage} from "@lib/util"
import KeyDownload from "@app/components/KeyDownload.svelte"
import HealthCheckReview from "@app/components/HealthCheckReview.svelte"
import {session, usePlugin} from "@app/core"
import {DEFAULT_RELAYS, DEFAULT_MESSAGING_RELAYS} from "@app/env"
import {pushModal} from "@app/modal"
import {pushToast} from "@app/toast"

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

export type HealthCheckPlan = {
  summary: string
  changes: HealthCheckChange[]
  apply: () => unknown
}

export type HealthCheck = {
  id: string
  title: string
  description: string
  isPending: (context: HealthCheckContext) => boolean
  plan: (context: HealthCheckContext) => HealthCheckPlan
}

const publishRelayList = async (command: Command) => {
  const error = await publish(command).waitForError()

  if (error) {
    pushToast({theme: "error", message: `Your relays couldn't be saved: ${errorMessage(error)}`})
  }
}

const relayPlan = (
  summary: string,
  label: string,
  current: string[],
  next: string[],
  apply: (urls: string[]) => unknown,
): HealthCheckPlan => {
  const currentUrls = current.map(normalizeRelayUrl)
  const nextUrls = next.map(normalizeRelayUrl)
  const added = nextUrls.filter(url => !currentUrls.includes(url))
  const removed = currentUrls.filter(url => !nextUrls.includes(url))
  const changes = added.length + removed.length > 0 ? [{label, added, removed}] : []

  return {summary, changes, apply: () => apply(nextUrls)}
}

export const reviewPlans = (plans: HealthCheckPlan[]) => {
  if (plans.some(plan => plan.changes.length > 0)) {
    pushModal(HealthCheckReview, {plans})
  } else {
    for (const plan of plans) {
      plan.apply()
    }
  }
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
      isPending: context => context.readRelays.length <= 1,
      plan: context =>
        relayPlan(
          "Sets your inbox relays to the ones this app recommends.",
          "Inbox relays",
          context.readRelays,
          DEFAULT_RELAYS,
          urls => this.app.use(RelayLists).setReadUrls(urls).then(publishRelayList),
        ),
    },
    {
      id: "missing-outbox-relays",
      title: "Missing Outbox Relays",
      description: "Other people aren't currently able to reliably find your public notes.",
      isPending: context => context.writeRelays.length <= 1,
      plan: context =>
        relayPlan(
          "Sets your outbox relays to the ones this app recommends.",
          "Outbox relays",
          context.writeRelays,
          DEFAULT_RELAYS,
          urls => this.app.use(RelayLists).setWriteUrls(urls).then(publishRelayList),
        ),
    },
    {
      id: "missing-dm-relays",
      title: "Missing DM Relays",
      description: "You aren't currently able to reliably send or receive direct messages.",
      isPending: context => context.messagingRelays.length <= 1,
      plan: context =>
        relayPlan(
          "Sets your DM relays to the ones this app recommends.",
          "DM relays",
          context.messagingRelays,
          DEFAULT_MESSAGING_RELAYS,
          urls => this.app.use(MessagingRelayLists).setUrls(urls).then(publishRelayList),
        ),
    },
    {
      id: "too-many-inbox-relays",
      title: "Too Many Inbox Relays",
      description:
        "You have more inbox relays than is really necessary, which can affect resource usage.",
      isPending: context => context.readRelays.length > 8,
      plan: context =>
        relayPlan(
          "Keeps five of your inbox relays and drops the rest.",
          "Inbox relays",
          context.readRelays,
          sample(5, context.readRelays),
          urls => this.app.use(RelayLists).setReadUrls(urls).then(publishRelayList),
        ),
    },
    {
      id: "too-many-outbox-relays",
      title: "Too Many Outbox Relays",
      description:
        "You have more outbox relays than is really necessary, which can affect resource usage.",
      isPending: context => context.writeRelays.length > 8,
      plan: context =>
        relayPlan(
          "Keeps five of your outbox relays and drops the rest.",
          "Outbox relays",
          context.writeRelays,
          sample(5, context.writeRelays),
          urls => this.app.use(RelayLists).setWriteUrls(urls).then(publishRelayList),
        ),
    },
    {
      id: "too-many-dm-relays",
      title: "Too Many DM Relays",
      description:
        "You have more DM relays than is really necessary, which can affect resource usage.",
      isPending: context => context.messagingRelays.length > 8,
      plan: context =>
        relayPlan(
          "Keeps five of your DM relays and drops the rest.",
          "DM relays",
          context.messagingRelays,
          sample(5, context.messagingRelays),
          urls => this.app.use(MessagingRelayLists).setUrls(urls).then(publishRelayList),
        ),
    },
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
          urls => this.app.use(SearchRelayLists).setUrls(urls).then(publishRelayList),
        ),
    },
    {
      id: "backup-key",
      title: "Back Up Your Key",
      description: "Save a backup of your private key in a secure place.",
      isPending: () => false,
      plan: () => ({
        summary: "Opens the key backup dialog, where you choose how to save your key.",
        changes: [],
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
      }),
    },
  ]

  isPending = (healthCheck: HealthCheck) =>
    get(forceHealthChecks)[healthCheck.id] ?? healthCheck.isPending(this.context.get())

  plan = (healthCheck: HealthCheck) => healthCheck.plan(this.context.get())
}

export const healthChecks = usePlugin(HealthChecks)
