<script lang="ts">
  import Restart from "@assets/icons/restart.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {deriveSpacePermissions, spaceManagement} from "@app/core/management"
  import {pushToast} from "@app/ui/toast"
  import {relayManagement} from "@app/core/plugins"

  type Props = {
    url: string
    pubkey: string
    onClick: () => void
  }

  const {url, pubkey, onClick}: Props = $props()

  const permissions = deriveSpacePermissions(url)

  const unbanMember = async () => {
    const {error} = await $relayManagement.forUrl(url).unbanPubkey(pubkey)

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "User has successfully been removed from the ban list!"})
      $spaceManagement.loadBannedPubkeys(url)
    }
  }

  const restoreMember = async () => {
    const {error} = await $relayManagement.forUrl(url).allowPubkey(pubkey)

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "User has successfully been restored to membership!"})
      $spaceManagement.loadBannedPubkeys(url)
    }
  }
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  {#if $permissions.unban}
    <li>
      <Button onclick={unbanMember}>
        <Icon icon={CloseCircle} />
        Unban User
      </Button>
    </li>
  {/if}
  {#if $permissions.addMembers}
    <li>
      <Button onclick={restoreMember}>
        <Icon icon={Restart} />
        Restore User
      </Button>
    </li>
  {/if}
</ul>
