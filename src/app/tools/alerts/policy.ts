import {difference, spec, union} from "@welshman/lib"
import {matchFilter, MESSAGE, WRAP} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {DM_KINDS} from "@lib/util"
import {getMutedRooms} from "@app/core/settings"
import type {SettingsValues} from "@app/core/settings"
import type {AlertTypes} from "@app/tools/alerts/settings"

const ALERT_TYPES = ["spaces", "mentions", "messages"] as const

export type AlertType = (typeof ALERT_TYPES)[number]

const getAlertTypeFilter = (type: AlertType, pubkey: string): Filter => {
  switch (type) {
    case "spaces":
      return {kinds: [MESSAGE]}
    case "mentions":
      return {kinds: [MESSAGE], "#p": [pubkey]}
    case "messages":
      return {kinds: DM_KINDS, "#p": [pubkey]}
  }
}

// A relay sees a direct message as the gift wrap, while we see the rumor inside it.
export const getAlertWireFilter = (type: AlertType, pubkey: string): Filter => {
  const filter = getAlertTypeFilter(type, pubkey)

  return type === "messages" ? {...filter, kinds: [WRAP]} : filter
}

export const getAlertTypes = (event: TrustedEvent, pubkey: string): AlertType[] =>
  ALERT_TYPES.filter(type => matchFilter(getAlertTypeFilter(type, pubkey), event))

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
      const skipped = union(exceptions, muted)

      if (skipped.length > 0) {
        ignore.push({"#h": skipped})
      }

      include.push(getAlertWireFilter("spaces", pubkey))
    } else {
      const included = difference(exceptions, muted)

      if (included.length > 0) {
        include.push({...getAlertWireFilter("spaces", pubkey), "#h": included})
      }
    }
  }

  if (types.mentions) {
    include.push(getAlertWireFilter("mentions", pubkey))
  }

  return {include, ignore}
}

export const getMessageAlertFilters = (types: AlertTypes, pubkey: string): Filter[] =>
  types.messages ? [getAlertWireFilter("messages", pubkey)] : []
