<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import {userSpaceUrls} from "@app/core/user"
  import {pushModal} from "@app/navigation/dialogs"
  import {goToSpace} from "@app/navigation/history"

  type Props = {
    url: string
    invite?: string
  }

  const {url, invite}: Props = $props()

  // The space page decides what a visitor is asked, so only an invite is handled here.
  const open = () => {
    if (invite && !$userSpaceUrls.includes(url)) {
      pushModal(SpaceInviteAccept, {invite})
    } else {
      goToSpace(url)
    }
  }
</script>

<Button class="card card-interactive" onclick={open}>
  <RelaySummary {url} />
</Button>
