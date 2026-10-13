<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import SpacePaymentGate from "@app/components/SpacePaymentGate.svelte"
  import {relays} from "@app/core/plugins"
  import {userSpaceUrls} from "@app/features/rooms"
  import {pushModal} from "@app/ui/modal"
  import {goToSpace} from "@app/ui/routes"

  type Props = {
    url: string
    invite?: string
  }

  const {url, invite}: Props = $props()

  const relay = $relays.one(url)

  const open = () => {
    if ($userSpaceUrls.includes(url)) {
      goToSpace(url)
    } else if (invite) {
      pushModal(SpaceInviteAccept, {invite})
    } else if ($relay?.isPaid()) {
      pushModal(SpacePaymentGate, {url})
    } else {
      pushModal(SpaceJoin, {url})
    }
  }
</script>

<Button class="card card-interactive" onclick={open}>
  <RelaySummary {url} />
</Button>
