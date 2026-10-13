import {DAY} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import type {Relay, RelayFee} from "@welshman/domain"

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
