import {derived} from "svelte/store"
import {RELAY_ROLE} from "@welshman/util"
import {RelayMemberLists} from "@welshman/app"
import {fromApp} from "@app/core/app"
import {registerSync} from "@app/core/sync"
import {syncCurrentSpace} from "@app/features/spaces/sync"

// Roles are rendered at a fixed saturation and lightness, chosen to read on both themes.
export const roleColor = (hue: number) => `hsl(${hue}, 70%, 50%)`

// A translucent tint of the role color for use as a background fill.
export const roleColorSoft = (hue: number) => `hsl(${hue}, 70%, 50%, 0.15)`

export const deriveSpaceMemberRoles = (url: string) =>
  derived(
    fromApp($app => $app.use(RelayMemberLists).forUrl(url)),
    $members => $members?.rolesByPubkey() ?? new Map<string, string[]>(),
  )

export const registerRoles = () => {
  registerSync(() => syncCurrentSpace([{kinds: [RELAY_ROLE]}]))
}
