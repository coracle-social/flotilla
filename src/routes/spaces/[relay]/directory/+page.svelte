<script lang="ts">
  import {derived} from "svelte/store"
  import {removeUndefined, sortBy} from "@welshman/lib"
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import MapIcon from "@assets/icons/map.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import SpaceMember from "@app/components/SpaceMember.svelte"
  import SpaceMemberMap from "@app/components/SpaceMemberMap.svelte"
  import SpaceInvite from "@app/components/SpaceInvite.svelte"
  import SpaceDirectoryMenu from "@app/components/SpaceDirectoryMenu.svelte"
  import {deriveSpacePermissions} from "@app/core/management"
  import {deriveSpaceMemberRoles} from "@app/features/roles"
  import {relayMemberLists, relayRoles} from "@app/core/plugins"
  import {deriveDisplaysByPubkey, deriveMemberPins} from "@app/features/social"
  import {decodeRelay} from "@app/core/relays"
  import {pushModal} from "@app/ui/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
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

  // A display is the npub until the profile loads, so search subscribes rather than reading once.
  const displays = $derived(
    deriveDisplaysByPubkey(
      $memberList.map(m => m.pubkey),
      url,
    ),
  )

  const pins = $derived(
    deriveMemberPins(
      $memberList.map(m => m.pubkey),
      url,
    ),
  )

  const matchesTerm = (pubkey: string, t: string) =>
    ($displays.get(pubkey) ?? "").toLowerCase().includes(t) || pubkey.toLowerCase().includes(t)

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

  const visiblePins = $derived.by(() => {
    const visible = new Set(visibleMembers.map(m => m.pubkey))

    return $pins.filter(pin => visible.has(pin.pubkey))
  })

  const toggleMap = () => (showMap = !showMap)

  let showMap = $state(false)
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={UsersGroup} />
  {/snippet}
  {#snippet title()}
    <strong>Members</strong>
  {/snippet}
  {#snippet action()}
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
  {/snippet}
</SpaceBar>

<PageContent class="@container flex flex-col gap-4 p-4">
  <div class="flex items-center gap-2">
    <label class="input input-group flex w-full items-center gap-2 card">
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
  {#if showMap && visiblePins.length > 0}
    <SpaceMemberMap {url} pins={visiblePins} />
  {:else if showMap}
    <p class="flex flex-col items-center py-20 text-center">No locations found.</p>
  {:else if visibleMembers.length === 0}
    <p class="flex flex-col items-center py-20 text-center">No members found.</p>
  {:else}
    <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @5xl:grid-cols-3">
      {#each visibleMembers as { pubkey, roleList } (pubkey)}
        <SpaceMember {url} {pubkey} roles={roleList} />
      {/each}
    </div>
  {/if}
</PageContent>
