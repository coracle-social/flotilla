import {Capacitor} from "@capacitor/core"
import {derived, writable} from "svelte/store"
import {append, remove, DAY} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {Relay, RelayFee} from "@welshman/domain"
import {Relays, User} from "@welshman/app"
import {app, fromApp} from "@app/core/app"
import {relayMemberLists, relays} from "@app/core/plugins"
import {PLATFORM_URL} from "@app/core/env"
import * as pages from "@app/navigation/pages"
import {completeSpaceJoin, deriveUserIsSpaceMember} from "@app/features/spaces/membership"

/**
 * A subscription is what a space charges; an admission fee is the fallback for a
 * relay that sells access once. Entries inside a category are alternatives, so
 * the first one that can be displayed is the one shown.
 */
export const getRelayFee = (relay: Maybe<Relay>) => {
  const fees = relay?.fees

  return (fees?.subscription || []).concat(fees?.admission || []).find(displayFee)
}

const periods: [number, string][] = [
  [365 * DAY, "year"],
  [30 * DAY, "month"],
  [7 * DAY, "week"],
  [DAY, "day"],
]

// A currency amount is in minor units; anything else is millisats.
const displayAmount = (fee: RelayFee) => {
  if (fee.unit === "msats") {
    return `${Math.round(fee.amount / 1000).toLocaleString()} sats`
  }

  return new Intl.NumberFormat(undefined, {style: "currency", currency: fee.unit}).format(
    fee.amount / 100,
  )
}

const displayPeriod = (period: number) => {
  const match = periods.find(([seconds]) => period === seconds)

  return match ? match[1] : `${Math.round(period / DAY)} days`
}

// Whether a fee can be shown, which for a currency means one Intl recognizes.
const displayFee = (fee: RelayFee) => {
  if (fee.unit === "msats") {
    return true
  }

  try {
    displayAmount(fee)

    return true
  } catch {
    return false
  }
}

export const displayRelayFee = (fee: RelayFee) => {
  const amount = displayAmount(fee)

  return fee.period ? `${amount} / ${displayPeriod(fee.period)}` : amount
}

// Gated out by price rather than by invitation: it charges, and they have not paid.
export const derivePaidGated = (url: string) =>
  derived(
    [fromApp($app => $app.use(Relays).one(url)), deriveUserIsSpaceMember(url), app],
    ([$relay, $isMember, $app]) => Boolean($relay?.isPaid() && $app.user && !$isMember),
  )

// Urls a checkout was opened for this session. A forgotten one is covered by membership sync.
export const pendingCheckouts = writable<string[]>([])

/**
 * Open a relay's payment page, naming the pubkey being paid for and where to
 * come back to. `payments_url` may carry a query of its own, so the parameters
 * are appended rather than written.
 */
export const openCheckout = (url: string) => {
  const paymentsUrl = relays.get().get(url)?.payments_url

  if (!paymentsUrl) {
    return "This space has not said where to pay."
  }

  // A payment page comes back to the app by universal link on native.
  const origin = Capacitor.isNativePlatform() ? PLATFORM_URL : location.origin
  const checkoutUrl = new URL(paymentsUrl)

  checkoutUrl.searchParams.set("pubkey", User.require(app.get()).pubkey)
  checkoutUrl.searchParams.set("return_url", origin + pages.space.path({url}))

  pendingCheckouts.update($urls => append(url, $urls))

  location.href = checkoutUrl.toString()
}

/**
 * Ask the relay again whether the user is a member, and finish the join if they
 * are. Membership is the source of truth: the return redirect is best effort,
 * and a payment made in another browser lands here too.
 */
export const reconcileSpaceMembership = async (url: string) => {
  // Auth that ended Forbidden before the payment never retries on its own.
  app.get().pool.get(url).close()

  const members = await relayMemberLists.get().forceLoad(url)

  if (!members?.isMember(User.require(app.get()).pubkey)) {
    return false
  }

  await completeSpaceJoin(url, true)

  pendingCheckouts.update($urls => remove(url, $urls))

  return true
}
