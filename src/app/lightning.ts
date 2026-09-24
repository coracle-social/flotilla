import {writable} from "svelte/store"
import {nwc} from "@getalby/sdk"
import {bech32ToHex, displayUrl, tryCatch} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {isNWCWallet, isWebLNWallet} from "@welshman/util"
import type {Wallet} from "@welshman/util"
import {withGetter} from "@welshman/store"

/** Both lud06 and lud16 normalize into the bech32 lnurl zapping needs, so decode it before display. */
export const displayLnurl = (lnurl: string) => {
  const url = tryCatch(() => bech32ToHex(lnurl))
  const address = url?.match(/^https?:\/\/([^/]+)\/\.well-known\/lnurlp\/(.+)$/)

  if (address) {
    const [, domain, name] = address

    return `${name}@${domain}`
  }

  return url ? displayUrl(url) : lnurl
}

export const wallet = withGetter(writable<Maybe<Wallet>>(undefined))

export const getWebLn = () => (window as any).webln

export const getNwcClient = () => {
  const $wallet = wallet.get()

  if (!$wallet || !isNWCWallet($wallet)) {
    throw new Error("No NWC wallet is connected")
  }

  const {info} = $wallet

  if (info.nostrWalletConnectUrl) {
    return new nwc.NWCClient({nostrWalletConnectUrl: info.nostrWalletConnectUrl})
  }

  return new nwc.NWCClient(info)
}

export const payInvoice = async (invoice: string, msats?: number) => {
  const $wallet = wallet.get()

  if (!$wallet) {
    throw new Error("No wallet is connected")
  }

  if (isNWCWallet($wallet)) {
    const params: {invoice: string; amount?: number} = {invoice}
    if (msats) {
      params.amount = msats
    }
    return getNwcClient().payInvoice(params)
  } else if (isWebLNWallet($wallet)) {
    if (msats) {
      throw new Error("Unable to pay zero invoices with webln")
    }
    return getWebLn()
      .enable()
      .then(() => getWebLn().sendPayment(invoice))
  }
}

export type CreateInvoiceParams = {
  sats: number
  description?: string
}

export const createInvoice = async ({
  sats,
  description = "Receive via lightning",
}: CreateInvoiceParams) => {
  const $wallet = wallet.get()

  if (!$wallet) {
    throw new Error("No wallet is connected")
  }

  const satAmount = Math.floor(sats)

  if (!Number.isFinite(satAmount) || satAmount <= 0) {
    throw new Error("Invalid satoshi amount")
  }

  if (isNWCWallet($wallet)) {
    const createdInvoice = await getNwcClient().makeInvoice({
      amount: satAmount * 1000,
      description,
    })

    if (!createdInvoice.invoice) {
      throw new Error("NWC wallet failed to return an invoice")
    }

    return createdInvoice.invoice
  }

  if (isWebLNWallet($wallet)) {
    const webLn = getWebLn()

    if (!webLn) {
      throw new Error("WebLN not available")
    }

    await webLn.enable()

    const response = await webLn.makeInvoice({
      amount: satAmount,
      defaultMemo: description,
    })

    const paymentRequest =
      typeof response === "string" ? response : response?.paymentRequest || response?.pr || ""

    if (!paymentRequest) {
      throw new Error("Invalid payment request returned from WebLN")
    }

    return paymentRequest
  }

  throw new Error("Unsupported wallet type")
}
