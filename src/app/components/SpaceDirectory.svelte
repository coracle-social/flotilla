<script lang="ts">
  import {derived} from "svelte/store"
  import {removeUndefined, sortBy} from "@welshman/lib"
  import {displayPubkey} from "@welshman/domain"
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import MapIcon from "@assets/icons/map.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import {decodeGeohash} from "@lib/geohash"
  import SpaceMember from "@app/components/SpaceMember.svelte"
  import SpaceMemberMap, {type MemberPin} from "@app/components/SpaceMemberMap.svelte"
  import SpaceInvite from "@app/components/SpaceInvite.svelte"
  import SpaceDirectoryMenu from "@app/components/SpaceDirectoryMenu.svelte"
  import {deriveSpacePermissions} from "@app/features/spaces/management"
  import {deriveSpaceMemberRoles} from "@app/features/spaces/roles"
  import {relayMemberLists, relayRoles} from "@app/core/plugins"
  import {getProfileGeohash} from "@app/features/location"
  import {deriveProfilesByPubkey} from "@app/features/people"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const roles = $relayRoles.forUrl(url).$
  const members = $relayMemberLists.forUrl(url)
  const memberRoles = deriveSpaceMemberRoles(url)
  const permissions = deriveSpacePermissions(url)

  // Each member with their resolved roles (sorted by order).
  const memberList = derived([members, memberRoles, roles], ([$members, $memberRoles, $roles]) => {
    const byId = new Map($roles.map(role => [role.identifier(), role]))

    return ($members?.pubkeys() ?? []).map(pubkey => ({
      pubkey,
      roleList: sortBy(
        role => role.order(),
        removeUndefined(($memberRoles.get(pubkey) ?? []).map(id => byId.get(id))),
      ),
    }))
  })

  const inviteMembers = () => pushModal(SpaceInvite, {url})

  // A role section matches on its own name, so it survives a term its members don't match.
  let term = $state("")

  const memberProfiles = $derived(
    deriveProfilesByPubkey(
      $memberList.map(m => m.pubkey),
      url,
    ),
  )

  // A display is the npub until the profile loads, so search subscribes rather than reading once.
  const displayMember = (pubkey: string) =>
    $memberProfiles.get(pubkey)?.display() ?? displayPubkey(pubkey)

  const matchesTerm = (pubkey: string, t: string) =>
    displayMember(pubkey).toLowerCase().includes(t) || pubkey.toLowerCase().includes(t)

  // In-place search: match by member info or by the name of any role they hold.
  const visibleMembers = $derived.by(() => {
    const t = term.trim().toLowerCase()

    if (!t) {
      return $memberList
    }

    return $memberList.filter(
      ({pubkey, roleList}) =>
        matchesTerm(pubkey, t) ||
        roleList.some(role => (role.label() ?? "").toLowerCase().includes(t)),
    )
  })

  // A member is on the map once their profile carries a location.
  const visiblePins = $derived.by(() => {
    const pins: MemberPin[] = []

    for (const {pubkey} of visibleMembers) {
      const coordinates = decodeGeohash(getProfileGeohash($memberProfiles.get(pubkey)))

      if (coordinates) {
        pins.push({pubkey, display: displayMember(pubkey), ...coordinates})
      }
    }

    return pins
  })

  const toggleMap = () => (showMap = !showMap)

  let showMap = $state(false)
</script>

<section class="card card-media flex shrink-0 flex-col">
  <div class="flex flex-col gap-3 border-b border-line p-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 text-lg font-bold">
        <Icon icon={UsersGroup} />
        Members
        <span class="font-normal text-content-muted">{$memberList.length}</span>
      </h2>
      <div class="flex items-center gap-2">
        <Button class="button button-primary button-sm" onclick={inviteMembers}>
          <Icon icon={AddCircle} />
          Invite people
        </Button>
        {#if $permissions.directoryMenu}
          <MenuButton
            class="button button-neutral button-sm button-square"
            aria-label="More options"
            iconSize={4}
            component={SpaceDirectoryMenu}
            componentProps={{url}} />
        {/if}
      </div>
    </div>
    <div class="flex items-center gap-2">
      <label class="input input-group flex w-full items-center gap-2">
        <Icon size={4} icon={Magnifier} />
        <input
          bind:value={term}
          class="min-w-0 grow"
          type="text"
          placeholder="Search people or roles..." />
      </label>
      <Button
        class="button button-input shrink-0 {showMap ? 'button-primary' : 'button-neutral'}"
        aria-pressed={showMap}
        onclick={toggleMap}>
        <Icon size={4} icon={MapIcon} />
        Map
      </Button>
    </div>
  </div>
  {#if showMap && visiblePins.length > 0}
    <SpaceMemberMap {url} pins={visiblePins} />
  {:else}
    <div class="bg-surface-less p-4">
      {#if showMap}
        <p class="py-20 text-center">No locations found.</p>
      {:else if visibleMembers.length === 0}
        <p class="py-20 text-center">No members found.</p>
      {:else}
        <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @5xl:grid-cols-3">
          {#each visibleMembers as { pubkey, roleList } (pubkey)}
            <SpaceMember {url} {pubkey} roles={roleList} />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</section>
