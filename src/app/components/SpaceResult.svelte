<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import SpacePaymentGate from "@app/components/SpacePaymentGate.svelte"
  import {relays} from "@app/core"
  import {isRelayPaid} from "@app/payments"
  import {userSpaceUrls} from "@app/rooms"
  import {pushModal} from "@app/modal"
  import {goToSpace} from "@app/routes"

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
    } else if (isRelayPaid($relay)) {
      pushModal(SpacePaymentGate, {url})
    } else {
      pushModal(SpaceJoin, {url})
    }
  }
</script>

<Button class="card card-interactive" onclick={open}>
  <RelaySummary {url} />
</Button>
