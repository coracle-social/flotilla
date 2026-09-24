<script lang="ts">
  import {derived} from "svelte/store"
  import {removeUndefined, sortBy} from "@welshman/lib"
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import ShieldUser from "@assets/icons/shield-user.svg?dataurl"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import SpaceMember from "@app/components/SpaceMember.svelte"
  import SpaceInvite from "@app/components/SpaceInvite.svelte"
  import SpaceAdmins from "@app/components/SpaceAdmins.svelte"
  import SpaceRoles from "@app/components/SpaceRoles.svelte"
  import SpaceMembersBanned from "@app/components/SpaceMembersBanned.svelte"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {deriveSpaceMemberRoles} from "@app/roles"
  import {relayMemberLists, relayRoles} from "@app/core"
  import {deriveDisplaysByPubkey} from "@app/social"
  import {decodeRelay} from "@app/relays"
  import {pushModal} from "@app/modal"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const roles = $relayRoles.forUrl(url).$
  const members = $relayMemberLists.forUrl(url)
  const memberRoles = deriveSpaceMemberRoles(url)
  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canManageRoles = $derived(
    ["createrole", "editrole", "deleterole"].some(method => $supportedMethods.includes(method)),
  )
  const canListBans = $derived($supportedMethods.includes("listbannedpubkeys"))
  const canListAdmins = $derived($supportedMethods.includes("listmethodassignees"))

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

  let menuOpen = $state(false)

  const inviteMembers = () => {
    menuOpen = false
    pushModal(SpaceInvite, {url})
  }

  const manageRoles = () => {
    menuOpen = false
    pushModal(SpaceRoles, {url})
  }

  const spaceAdmins = () => {
    menuOpen = false
    pushModal(SpaceAdmins, {url})
  }

  const bannedMembers = () => {
    menuOpen = false
    pushModal(SpaceMembersBanned, {url})
  }

  // A role section matches on its own name, so it survives a term its members don't match.
  let term = $state("")

  // A display is the npub until the profile loads, so search subscribes rather than reading once.
  const displays = $derived(
    deriveDisplaysByPubkey(
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
    {#if canManageRoles || canListBans || canListAdmins}
      <div class="relative">
        <Button
          class="button button-neutral button-sm button-square"
          aria-label="More options"
          onclick={() => (menuOpen = !menuOpen)}>
          <Icon size={4} icon={MenuDots} />
        </Button>
        {#if menuOpen}
          <Popover hideOnClick onClose={() => (menuOpen = false)}>
            <ul
              transition:fly
              class="menu bg-surface absolute right-0 z-popover mt-2 w-48 gap-1 rounded-2xl p-2">
              {#if canManageRoles}
                <li>
                  <Button onclick={manageRoles}>
                    <Icon icon={UsersGroup} />
                    Manage Roles
                  </Button>
                </li>
              {/if}
              {#if canListAdmins}
                <li>
                  <Button onclick={spaceAdmins}>
                    <Icon icon={ShieldUser} />
                    Admins
                  </Button>
                </li>
              {/if}
              {#if canListBans}
                <li>
                  <Button onclick={bannedMembers}>
                    <Icon icon={MinusCircle} />
                    Banned Members
                  </Button>
                </li>
              {/if}
            </ul>
          </Popover>
        {/if}
      </div>
    {/if}
  {/snippet}
</SpaceBar>

<PageContent class="@container flex flex-col gap-4 p-4">
  <label class="input input-group flex w-full items-center gap-2 card">
    <Icon size={4} icon={Magnifier} />
    <input
      bind:value={term}
      class="min-w-0 grow"
      type="text"
      placeholder="Search people or roles..." />
  </label>
  {#if visibleMembers.length === 0}
    <p class="flex flex-col items-center py-20 text-center">No members found.</p>
  {:else}
    <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @5xl:grid-cols-3">
      {#each visibleMembers as { pubkey, roleList } (pubkey)}
        <SpaceMember {url} {pubkey} roles={roleList} />
      {/each}
    </div>
  {/if}
</PageContent>
