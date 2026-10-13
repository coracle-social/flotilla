import {derived} from "svelte/store"
import {RelayMemberLists} from "@welshman/app"
import {fromApp} from "@app/core"

// Roles are rendered at a fixed saturation and lightness, chosen to read on both themes.
export const roleColor = (hue: number) => `hsl(${hue}, 70%, 50%)`

// A translucent tint of the role color for use as a background fill.
export const roleColorSoft = (hue: number) => `hsl(${hue}, 70%, 50%, 0.15)`

export const deriveSpaceMemberRoles = (url: string) =>
  derived(
    fromApp($app => $app.use(RelayMemberLists).forUrl(url)),
    $members => $members?.rolesByPubkey() ?? new Map<string, string[]>(),
  )
