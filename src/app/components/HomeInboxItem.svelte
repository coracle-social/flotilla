<script lang="ts">
  import HomeInboxItemChat from "@app/components/HomeInboxItemChat.svelte"
  import HomeInboxItemRoom from "@app/components/HomeInboxItemRoom.svelte"
  import HomeInboxItemSpaceChat from "@app/components/HomeInboxItemSpaceChat.svelte"
  import type {Activity} from "@app/notifications"

  type Props = {
    conversation: Activity
  }

  const {conversation}: Props = $props()
</script>

{#if conversation.url && conversation.h}
  <HomeInboxItemRoom
    path={conversation.path}
    url={conversation.url}
    h={conversation.h}
    event={conversation.event} />
{:else if conversation.url}
  <HomeInboxItemSpaceChat
    path={conversation.path}
    url={conversation.url}
    event={conversation.event} />
{:else}
  <HomeInboxItemChat
    path={conversation.path}
    pubkeys={conversation.pubkeys ?? []}
    event={conversation.event} />
{/if}
