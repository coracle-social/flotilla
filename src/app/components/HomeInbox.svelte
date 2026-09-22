<script lang="ts">
  import Inbox from "@assets/icons/inbox.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HomeInboxItem from "@app/components/HomeInboxItem.svelte"
  import {inboxConversations} from "@app/inbox"
  import {navigate} from "@app/modal"
  import {allNotifications, setChecked} from "@app/notifications"

  const conversations = $derived($inboxConversations.slice(0, 8))

  const markAllRead = () => setChecked("*")

  const startChat = () => navigate("/chat")
</script>

<HomeSection title="Inbox" icon={Inbox}>
  {#snippet action()}
    {#if $allNotifications.size > 0}
      <Button class="button button-neutral button-xs" onclick={markAllRead}>Mark all read</Button>
    {/if}
  {/snippet}
  {#if conversations.length > 0}
    <div class="flex flex-col gap-3 border-t border-line bg-surface-less p-4">
      {#each conversations as conversation (conversation.path)}
        <HomeInboxItem {conversation} />
      {/each}
    </div>
  {:else}
    <div
      class="flex flex-col items-center gap-3 border-t border-line bg-surface-less px-4 py-8 text-center">
      <p class="font-medium">You're all caught up</p>
      <p class="max-w-md text-sm opacity-75">
        The rooms, space chats and direct messages you belong to show what's unread here.
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <Link href="/spaces" class="button button-primary button-sm">
          <Icon icon={AddCircle} size={4} />
          Add a space
        </Link>
        <Button class="button button-neutral button-sm" onclick={startChat}>
          <Icon icon={ChatRound} size={4} />
          Start a conversation
        </Button>
      </div>
    </div>
  {/if}
</HomeSection>
