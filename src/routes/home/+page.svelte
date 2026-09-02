<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import {goToSpace} from "@app/routes"
  import {PLATFORM_NAME, PLATFORM_RELAYS} from "@app/env"

  const openChat = () => goto("/chat")

  onMount(async () => {
    if (PLATFORM_RELAYS.length > 0) {
      goToSpace(PLATFORM_RELAYS[0], {replaceState: true})
    }
  })
</script>

<div class="m-auto min-h-screen overflow-auto pb-8 h-full flex items-center">
  <div class="p-4">
    <PageContent class="flex flex-col gap-4">
      <h1 class="text-center text-5xl">Welcome to</h1>
      <h1 class="mb-4 text-center text-5xl font-bold uppercase">{PLATFORM_NAME}</h1>
      <div class="flex flex-col gap-3">
        <Link href="/spaces">
          <CardButton>
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
        </Link>
        <Button onclick={openChat}>
          <CardButton>
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
    </PageContent>
  </div>
</div>
