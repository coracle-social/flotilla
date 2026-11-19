import {derived, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import {sortBy, spec} from "@welshman/lib"
import {roomLists, usePlugin} from "@app/core/plugins"
import {requireUser} from "@app/core/user"
import {goToMovedSpace} from "@app/navigation/history"
import {publishRoomList} from "@app/tools/publish"
import type {Activity, HostedRelay, Invoice, Plan, Tenant} from "@app/areas/hosting/model"
import {autopayConfigured, getHostedRelayUrl, selectPayableInvoice} from "@app/areas/hosting/model"
import {
  getDraftInvoice,
  getTenant,
  listPlans,
  listRelayActivity,
  listRelayMembers,
  listTenantInvoices,
  listTenantRelays,
  logUnexpectedError,
  reconcileTenant,
} from "@app/areas/hosting/api"

export type Loading<T> = {loading: boolean; value: T}

export type TenantBilling = {
  tenant: Maybe<Tenant>
  invoices: Invoice[]
  draftInvoice: Maybe<Invoice>
}

// The tenant is the signed-in pubkey, so what's loaded for it lives on the app and goes with a login.
export class Hosting {
  private plansRequest: Maybe<Promise<Plan[]>>

  private relayState = writable<Loading<HostedRelay[]>>({loading: true, value: []})

  billing = writable<TenantBilling>({tenant: undefined, invoices: [], draftInvoice: undefined})

  loadPlans = () => {
    this.plansRequest ??= listPlans().catch((e): Plan[] => {
      this.plansRequest = undefined
      logUnexpectedError(e)
      return []
    })

    return this.plansRequest
  }

  plans = readable<Plan[]>([], set => {
    this.loadPlans().then(set)
  })

  loadRelays = async () => {
    this.relayState.update($state => ({...$state, loading: true}))

    try {
      const relays = await listTenantRelays(requireUser().pubkey)

      this.relayState.set({loading: false, value: relays})
    } catch (e) {
      this.relayState.update($state => ({...$state, loading: false}))

      throw e
    }
  }

  // A pubkey with no tenant answers with a HostingError, which leaves the list empty.
  relays = readable<Loading<HostedRelay[]>>({loading: true, value: []}, set => {
    this.loadRelays().catch(logUnexpectedError)

    return this.relayState.subscribe(set)
  })

  setRelay = (relay: HostedRelay) =>
    this.relayState.update($state => ({
      ...$state,
      value: $state.value.some(spec({id: relay.id}))
        ? $state.value.map(r => (r.id === relay.id ? relay : r))
        : [...$state.value, relay],
    }))

  // Each request lands on its own, so one failure doesn't blank what the others loaded.
  refresh = async () => {
    const {pubkey} = requireUser()
    const results = await Promise.allSettled([
      getTenant(pubkey),
      listTenantInvoices(pubkey),
      getDraftInvoice(pubkey),
      this.loadRelays(),
    ])

    const [tenant, invoices, draftInvoice] = results

    this.billing.update($billing => ({
      tenant: tenant.status === "fulfilled" ? tenant.value : $billing.tenant,
      invoices:
        invoices.status === "fulfilled"
          ? sortBy(invoice => -invoice.created_at, invoices.value)
          : $billing.invoices,
      draftInvoice:
        draftInvoice.status === "fulfilled" ? draftInvoice.value : $billing.draftInvoice,
    }))

    for (const result of results) {
      if (result.status === "rejected") {
        logUnexpectedError(result.reason)
      }
    }

    return results.every(spec({status: "fulfilled"}))
  }

  // Settles the balance, then says what a tenant without autopay still owes: an open invoice, or a method.
  findPaymentDue = async (): Promise<Maybe<{invoice: Maybe<Invoice>}>> => {
    const {pubkey} = requireUser()

    await reconcileTenant(pubkey)

    const tenant = await getTenant(pubkey)

    this.billing.update($billing => ({...$billing, tenant}))

    if (!autopayConfigured(tenant)) {
      return {invoice: selectPayableInvoice(await listTenantInvoices(pubkey))}
    }
  }
}

export const hosting = usePlugin(Hosting)

// A new subdomain or a verified custom domain moves the relay, so the room list and the page follow it.
export const followHostedRelay = async (previous: HostedRelay, next: HostedRelay) => {
  const previousUrl = getHostedRelayUrl(previous)
  const nextUrl = getHostedRelayUrl(next)

  if (previousUrl !== nextUrl) {
    await roomLists
      .get()
      .migrateRelay(previousUrl, nextUrl)
      .then(command => command && publishRoomList(command))
    await goToMovedSpace(previousUrl, nextUrl)
  }

  hosting.get().setRelay(next)
}

export const deriveRelayMembers = (id: string) =>
  readable<string[]>([], set => {
    listRelayMembers(id).then(
      ({members}) => set(members),
      () => set([]),
    )
  })

// The id comes from the hosted relay lookup, which hasn't resolved when the page mounts.
export const deriveRelayActivity = (id: Readable<Maybe<string>>) =>
  derived<Readable<Maybe<string>>, Loading<Activity[]>>(
    id,
    ($id, set) => {
      if ($id) {
        set({loading: true, value: []})

        listRelayActivity($id).then(
          ({activity}) => set({loading: false, value: activity}),
          () => set({loading: false, value: []}),
        )
      } else {
        set({loading: false, value: []})
      }
    },
    {loading: false, value: []},
  )

// Loading and "not hosted here" both leave the value undefined, and only one keeps the caller waiting.
export const deriveHostedRelay = (url: string) =>
  derived<Readable<Loading<HostedRelay[]>>, Loading<Maybe<HostedRelay>>>(
    hosting.get().relays,
    ({loading, value: relays}) => ({
      loading,
      value: relays.find(r => getHostedRelayUrl(r) === url),
    }),
  )
