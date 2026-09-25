import {derived, readable, writable} from "svelte/store"
import {ago, MINUTE, now, simpleCache} from "@welshman/lib"
import {ROOM_CREATE_PERMISSION, hexTags, tagValues} from "@welshman/util"
import {RelayManagement, Relays} from "@welshman/app"
import type {IApp} from "@welshman/app"
import {events, fromApp, usePlugin, user} from "@app/core"

// `supportedmethods` answers for the pubkey that signed the request, so this catalog is the client's.
export const MANAGEMENT_METHOD_GROUPS = [
  {
    label: "Members",
    methods: [
      {method: "allowpubkey", label: "Add members"},
      {method: "unallowpubkey", label: "Remove members"},
      {method: "listallowedpubkeys", label: "List members"},
      {method: "banpubkey", label: "Ban members"},
      {method: "unbanpubkey", label: "Unban members"},
      {method: "listbannedpubkeys", label: "List banned members"},
    ],
  },
  {
    label: "Content",
    methods: [
      {method: "banevent", label: "Delete content"},
      {method: "allowevent", label: "Dismiss reports"},
      {method: "listbannedevents", label: "List deleted content"},
    ],
  },
  {
    label: "Roles",
    methods: [
      {method: "createrole", label: "Create roles"},
      {method: "editrole", label: "Edit roles"},
      {method: "deleterole", label: "Delete roles"},
      {method: "assignrole", label: "Assign roles"},
      {method: "unassignrole", label: "Unassign roles"},
    ],
  },
  {
    label: "Invites",
    methods: [
      {method: "createclaim", label: "Create invites"},
      {method: "deleteclaim", label: "Delete invites"},
      {method: "listclaims", label: "List invites"},
    ],
  },
  {
    label: "Space",
    methods: [
      {method: "changerelayname", label: "Change the name"},
      {method: "changerelaydescription", label: "Change the description"},
      {method: "changerelayicon", label: "Change the icon"},
    ],
  },
  {
    label: "Admins",
    methods: [
      {method: "assignmethod", label: "Grant permissions"},
      {method: "unassignmethod", label: "Revoke permissions"},
      {method: "listmethodassignees", label: "List admins"},
    ],
  },
]

const methodLabels = new Map(
  MANAGEMENT_METHOD_GROUPS.flatMap(group =>
    group.methods.map(({method, label}): [string, string] => [method, label]),
  ),
)

export const displayManagementMethod = (method: string) => methodLabels.get(method) ?? method

export type MethodAssigneeItem = {
  pubkey: string
  methods: string[]
}

export type BannedPubkeyItem = {
  pubkey: string
  reason: string
}

// `supportedmethods` answers for the pubkey that signed the request, so the cache lives on the app.
export class SpaceManagement {
  private methodRequests = new Map<string, {checkedAt: number; request: Promise<string[]>}>()

  constructor(private readonly app: IApp) {}

  loadSupportedMethods = (url: string) => {
    const cached = this.methodRequests.get(url)

    if (cached && cached.checkedAt >= ago(5, MINUTE)) {
      return cached.request
    }

    const request = this.app
      .use(RelayManagement)
      .forUrl(url)
      .supportedMethods()
      .then(({result = []}): string[] => result)
      .catch((error): string[] => {
        this.methodRequests.delete(url)
        console.error(error)
        return []
      })

    this.methodRequests.set(url, {checkedAt: now(), request})

    return request
  }

  supportedMethods = simpleCache(([url]: [url: string]) =>
    readable<string[]>([], set => {
      this.loadSupportedMethods(url).then(set)
    }),
  )

  methodAssignees = simpleCache(([url]: [url: string]) => writable<MethodAssigneeItem[]>([]))

  loadMethodAssignees = async (url: string) => {
    const {result, error} = await this.app.use(RelayManagement).forUrl(url).listMethodAssignees()

    if (result) {
      this.methodAssignees(url).set(result)
    }

    return error
  }

  bannedPubkeys = simpleCache(([url]: [url: string]) => writable<BannedPubkeyItem[]>([]))

  loadBannedPubkeys = async (url: string) => {
    const {result, error} = await this.app.use(RelayManagement).forUrl(url).listBannedPubkeys()

    if (result) {
      this.bannedPubkeys(url).set(result)
    }

    return error
  }
}

export const spaceManagement = usePlugin(SpaceManagement)

const deriveSpaceSupportedMethods = (url?: string) =>
  fromApp($app => {
    if (url && $app.user) {
      return $app.use(SpaceManagement).supportedMethods(url)
    }

    return readable<string[]>([])
  })

const getSpacePermissions = (methods: string[]) => {
  const can = (method: string) => methods.includes(method)

  const addMembers = can("allowpubkey")
  const removeMembers = can("unallowpubkey")
  const ban = can("banpubkey")
  const unban = can("unbanpubkey")
  const listBans = can("listbannedpubkeys")
  const deleteContent = can("banevent")
  const createRoles = can("createrole")
  const editRoles = can("editrole")
  const deleteRoles = can("deleterole")
  const assignRoles = can("assignrole")
  const unassignRoles = can("unassignrole")
  const assignMethods = can("assignmethod")
  const unassignMethods = can("unassignmethod")
  const listAdmins = can("listmethodassignees")
  const editAdmins = assignMethods || unassignMethods
  const editMethods = listAdmins && editAdmins
  const manageRoles = createRoles || editRoles || deleteRoles

  return {
    addMembers,
    removeMembers,
    ban,
    unban,
    listBans,
    deleteContent,
    createRoles,
    editRoles,
    deleteRoles,
    assignRoles,
    unassignRoles,
    assignMethods,
    unassignMethods,
    listAdmins,
    editAdmins,
    editMethods,
    manageRoles,
    editSpace: ["changerelayname", "changerelaydescription", "changerelayicon"].some(can),
    review: deleteContent || addMembers,
    memberMenu: assignRoles || unassignRoles || removeMembers || ban || editMethods,
    roleMenu: editRoles || deleteRoles || assignRoles,
    bannedMenu: unban || addMembers,
    directoryMenu: manageRoles || listBans || listAdmins,
  }
}

// Each control is gated on the NIP-86 method behind it, as reported for the signed-in user.
export const deriveSpacePermissions = (url?: string) =>
  derived(deriveSpaceSupportedMethods(url), getSpacePermissions)

// User

// Holding any management method makes someone staff, for the room permissions NIP-86 has no method for.
export const deriveUserIsSpaceStaff = (url?: string) =>
  derived(deriveSpaceSupportedMethods(url), $methods => $methods.length > 0)

// The one identity a space names as its own, in its NIP-11 `pubkey`.
export const deriveUserIsSpaceOwner = (url: string) =>
  derived(
    [user, fromApp($app => $app.use(Relays).one(url))],
    ([$user, $relay]) => $user.pubkey === $relay?.pubkey,
  )

export const deriveUserCanCreateRoom = (url: string) =>
  derived(
    [
      user,
      events.get().forUrl(url, [{kinds: [ROOM_CREATE_PERMISSION]}]).$,
      deriveUserIsSpaceStaff(url),
    ],
    ([$user, $events, $isStaff]) =>
      $isStaff || $events.some(event => tagValues(hexTags("p"), event.tags).includes($user.pubkey)),
  )
