<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import SpacePaymentGate from "@app/components/SpacePaymentGate.svelte"
  import {relays} from "@app/core/plugins"
  import {user, userSpaceUrls} from "@app/core/user"
  import {pushModal} from "@app/navigation/dialogs"
  import {goToSpace} from "@app/navigation/history"
  import {withLogin} from "@app/components/flows/login"

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
      withLogin("join this space", () => pushModal(SpaceInviteAccept, {invite}))
    } else if ($user) {
      if ($relay?.isPaid()) {
        pushModal(SpacePaymentGate, {url})
      } else {
        pushModal(SpaceJoin, {url})
      }
    } else {
      // A visitor looks around before joining.
      goToSpace(url)
    }
  }
</script>

<Button class="card card-interactive" onclick={open}>
  <RelaySummary {url} />
</Button>
