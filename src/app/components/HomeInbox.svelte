<script lang="ts">
  import Inbox from "@assets/icons/inbox.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HomeActivity from "@app/components/HomeActivity.svelte"
  import HealthCheckList from "@app/components/HealthCheckList.svelte"
  import HomeInboxItem from "@app/components/HomeInboxItem.svelte"
  import {allNotifications} from "@app/features/notifications"
  import {inboxConversations, inboxSpaceContent} from "@app/features/inbox"
  import {setChecked} from "@app/features/checked"

  const conversations = $derived($inboxConversations.slice(0, 8))

  const markAllRead = () => setChecked("*")
</script>

<HomeSection title="Inbox" icon={Inbox}>
  {#snippet action()}
    {#if $allNotifications.size > 0}
      <Button class="button button-neutral button-xs" onclick={markAllRead}>Mark all read</Button>
    {/if}
  {/snippet}
  <HealthCheckList class="bg-surface-less @3xl:hidden" />
  {#if conversations.length > 0}
    <div class="flex flex-col divide-y divide-line border-t border-line bg-surface-less">
      {#each conversations as conversation (conversation.path)}
        <HomeInboxItem {conversation} />
      {/each}
    </div>
  {/if}
  {#if $inboxSpaceContent.length > 0}
    <HomeActivity spaces={$inboxSpaceContent} />
  {/if}
  {#if conversations.length === 0 && $inboxSpaceContent.length === 0}
    <div
      class="flex flex-col items-center gap-3 border-t border-line bg-surface-less px-4 py-12 text-center">
      <p class="font-medium">You're all caught up</p>
      <p class="max-w-md text-sm opacity-75">
        Anything unread in your rooms, space chats and direct messages appears here.
      </p>
    </div>
  {/if}
</HomeSection>
