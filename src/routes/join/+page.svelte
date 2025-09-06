<script lang="ts">
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import Icon from "@lib/components/Icon.svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import Button from "@lib/components/Button.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
</script>

<Dialog>
  <SpaceInviteAccept invite={$page.url.href}>
    {#snippet abortAction()}
      <Button class="btn btn-link" onclick={() => goto("/home")}>
        <Icon icon="alt-arrow-left" />
        Go back
      </Button>
    {/snippet}
  </SpaceInviteAccept>
</Dialog>
