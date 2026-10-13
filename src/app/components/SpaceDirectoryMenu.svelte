<script lang="ts">
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import ShieldUser from "@assets/icons/shield-user.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceAdmins from "@app/components/SpaceAdmins.svelte"
  import SpaceRoles from "@app/components/SpaceRoles.svelte"
  import SpaceMembersBanned from "@app/components/SpaceMembersBanned.svelte"
  import {deriveSpacePermissions} from "@app/core/management"
  import {pushModal} from "@app/ui/modal"

  type Props = {
    url: string
    onClick: () => void
  }

  const {url, onClick}: Props = $props()

  const permissions = deriveSpacePermissions(url)

  const manageRoles = () => pushModal(SpaceRoles, {url})

  const spaceAdmins = () => pushModal(SpaceAdmins, {url})

  const bannedMembers = () => pushModal(SpaceMembersBanned, {url})
</script>

<ul class="menu w-48 gap-1 rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  {#if $permissions.manageRoles}
    <li>
      <Button onclick={manageRoles}>
        <Icon icon={UsersGroup} />
        Manage Roles
      </Button>
    </li>
  {/if}
  {#if $permissions.listAdmins}
    <li>
      <Button onclick={spaceAdmins}>
        <Icon icon={ShieldUser} />
        Admins
      </Button>
    </li>
  {/if}
  {#if $permissions.listBans}
    <li>
      <Button onclick={bannedMembers}>
        <Icon icon={MinusCircle} />
        Banned Members
      </Button>
    </li>
  {/if}
</ul>
