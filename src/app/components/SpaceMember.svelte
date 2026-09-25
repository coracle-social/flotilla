<script lang="ts">
  import type {RelayRoleReader} from "@welshman/domain"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileAbout from "@app/components/ProfileAbout.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import SpaceMemberMenu from "@app/components/SpaceMemberMenu.svelte"
  import RoleBadge from "@app/components/RoleBadge.svelte"
  import {deriveSpacePermissions} from "@app/management"
  import {pushModal} from "@app/modal"
  import {profiles} from "@app/core"

  interface Props {
    url: string
    pubkey: string
    roles?: RelayRoleReader[]
  }

  const {url, pubkey, roles = []}: Props = $props()

  const profileDisplay = $profiles.display(pubkey, [url]).$
  const permissions = deriveSpacePermissions(url)

  const openProfile = () => pushModal(ProfileDetail, {pubkey, url})
</script>

<div class="card card-interactive card-sm relative">
  <button
    type="button"
    class="absolute inset-0 cursor-pointer rounded-2xl"
    aria-label="View {$profileDisplay}'s profile"
    onclick={openProfile}>
  </button>
  <div class="pointer-events-none relative flex items-start justify-between gap-2">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <Profile {pubkey} {url} inert />
      {#if roles.length > 0}
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          {#each roles as role (role.identifier())}
            <RoleBadge {role} />
          {/each}
        </div>
      {/if}
      <div class="line-clamp-1 text-sm opacity-70">
        <ProfileAbout {pubkey} {url} singleLine />
      </div>
    </div>
    {#if $permissions.memberMenu}
      <div class="pointer-events-auto shrink-0">
        <MenuButton
          class="button button-ghost button-sm button-square"
          component={SpaceMemberMenu}
          componentProps={{url, pubkey}} />
      </div>
    {/if}
  </div>
</div>
