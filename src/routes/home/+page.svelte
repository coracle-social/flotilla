<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {shouldUnwrap} from "@welshman/app"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Compass from "@assets/icons/compass.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import SpaceAdd from "@app/components/SpaceAdd.svelte"
  import ChatEnable from "@app/components/ChatEnable.svelte"
  import {pushModal} from "@app/util/modal"
  import {goToSpace} from "@app/util/routes"
  import {PLATFORM_NAME, PLATFORM_RELAYS} from "@app/core/state"

  const addSpace = () => pushModal(SpaceAdd)

  const openChat = () => ($shouldUnwrap ? goto("/chat") : pushModal(ChatEnable, {next: "/chat"}))

  onMount(async () => {
    if (PLATFORM_RELAYS.length > 0) {
      goToSpace(PLATFORM_RELAYS[0])
    }
  })
</script>

<div class="hero min-h-screen overflow-auto pb-8">
  <div class="hero-content">
    <div class="column content gap-4">
      <h1 class="text-center text-5xl">Welcome to</h1>
      <h1 class="mb-4 text-center text-5xl font-bold uppercase">{PLATFORM_NAME}</h1>
      <div class="col-3">
        <Button onclick={addSpace}>
          <CardButton class="btn-neutral">
            {#snippet icon()}
              <Icon icon={AddCircle} size={7} />
            {/snippet}
            {#snippet title()}
              <div>Add a space</div>
            {/snippet}
            {#snippet info()}
              <div>Use an invite link, or create your own space.</div>
            {/snippet}
          </CardButton>
        </Button>
        <Link href="/discover">
          <CardButton class="btn-neutral">
            {#snippet icon()}
              <Icon icon={Compass} size={7} />
            {/snippet}
            {#snippet title()}
              <div>Browse the network</div>
            {/snippet}
            {#snippet info()}
              <div>Find communities on the nostr network.</div>
            {/snippet}
          </CardButton>
        </Link>
        <Button onclick={openChat}>
          <CardButton class="btn-neutral">
            {#snippet icon()}
              <Icon icon={ChatRound} size={7} />
            {/snippet}
            {#snippet title()}
              <div>Start a conversation</div>
            {/snippet}
            {#snippet info()}
              <div>Use nostr's encrypted group chats to stay in touch.</div>
            {/snippet}
          </CardButton>
        </Button>
      </div>
    </div>
  </div>
</div>
