<script lang="ts">
  import Pen from "@assets/icons/pen.svg?dataurl"
  import ShieldUser from "@assets/icons/shield-user.svg?dataurl"
  import Tuning from "@assets/icons/tuning-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceMemberMethods from "@app/components/SpaceMemberMethods.svelte"
  import SpaceMemberRoles from "@app/components/SpaceMemberRoles.svelte"
  import SpaceMemberManage from "@app/components/SpaceMemberManage.svelte"
  import {deriveSpacePermissions} from "@app/features/spaces/management"
  import {deriveMemberModeration} from "@app/features/spaces/rooms"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    url: string
    pubkey: string
    onClick: () => void
  }

  const {url, pubkey, onClick}: Props = $props()

  const permissions = deriveSpacePermissions(url)
  const moderation = deriveMemberModeration(url)

  const editRoles = () => pushModal(SpaceMemberRoles, {url, pubkey})

  const editMethods = () => pushModal(SpaceMemberMethods, {url, pubkey})

  const manageMember = () => pushModal(SpaceMemberManage, {url, pubkey})
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  {#if $permissions.assignRoles || $permissions.unassignRoles}
    <li>
      <Button onclick={editRoles}>
        <Icon icon={Pen} />
        Edit roles
      </Button>
    </li>
  {/if}
  {#if $permissions.editMethods}
    <li>
      <Button onclick={editMethods}>
        <Icon icon={ShieldUser} />
        Edit permissions
      </Button>
    </li>
  {/if}
  {#if $moderation(pubkey).manage}
    <li>
      <Button onclick={manageMember}>
        <Icon icon={Tuning} />
        Manage member
      </Button>
    </li>
  {/if}
</ul>
