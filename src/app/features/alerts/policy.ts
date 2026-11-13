import {spec, uniq} from "@welshman/lib"
import {matchFilter, MESSAGE, WRAP} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {DM_KINDS} from "@lib/util"
import {getMutedRooms} from "@app/core/settings"
import type {SettingsValues} from "@app/core/settings"
import type {AlertTypes} from "@app/features/alerts/settings"

const ALERT_TYPES = ["spaces", "mentions", "messages"] as const

export type AlertType = (typeof ALERT_TYPES)[number]

type AlertTypeFilter = {
  kinds: number[]
  wireKinds: number[]
  addressed: boolean
}

// One definition per type, read here as an event and on a relay as a subscription filter.
const typeFilters: Record<AlertType, AlertTypeFilter> = {
  spaces: {kinds: [MESSAGE], wireKinds: [MESSAGE], addressed: false},
  mentions: {kinds: [MESSAGE], wireKinds: [MESSAGE], addressed: true},
  messages: {kinds: DM_KINDS, wireKinds: [WRAP], addressed: true},
}

const makeFilter = (kinds: number[], addressed: boolean, pubkey: string): Filter =>
  addressed ? {kinds, "#p": [pubkey]} : {kinds}

const getTypeFilter = (type: AlertType, pubkey: string) => {
  const {kinds, addressed} = typeFilters[type]

  return makeFilter(kinds, addressed, pubkey)
}

// A relay sees a direct message as the gift wrap, while we see the rumor inside it.
const getWireFilter = (type: AlertType, pubkey: string) => {
  const {wireKinds, addressed} = typeFilters[type]

  return makeFilter(wireKinds, addressed, pubkey)
}

export const getEventAlertTypes = (event: TrustedEvent, pubkey: string): AlertType[] =>
  ALERT_TYPES.filter(type => matchFilter(getTypeFilter(type, pubkey), event))

// A space's rooms, minus the ones the space doesn't notify for or has muted.
export const getSpaceAlertFilters = ({
  url,
  types,
  settings,
  pubkey,
}: {
  url: string
  types: AlertTypes
  settings: SettingsValues
  pubkey: string
}) => {
  const {notify = true, exceptions = []} = settings.alerts.find(spec({url})) || {}
  const muted = getMutedRooms(settings, url)
  const include: Filter[] = []
  const ignore: Filter[] = []

  if (types.spaces) {
    if (notify) {
      const skipped = uniq([...exceptions, ...muted])

      if (skipped.length > 0) {
        ignore.push({"#h": skipped})
      }

      include.push(getWireFilter("spaces", pubkey))
    } else {
      const included = exceptions.filter(h => !muted.includes(h))

      if (included.length > 0) {
        include.push({...getWireFilter("spaces", pubkey), "#h": included})
      }
    }
  }

  if (types.mentions) {
    include.push(getWireFilter("mentions", pubkey))
  }

  return {include, ignore}
}

export const getMessageAlertFilters = (types: AlertTypes, pubkey: string): Filter[] =>
  types.messages ? [getWireFilter("messages", pubkey)] : []
