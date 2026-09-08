<script lang="ts">
  import Inbox from "@assets/icons/inbox.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import HomeInboxItem from "@app/components/HomeInboxItem.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {displayContentCount} from "@app/content"
  import {inboxConversations, inboxSpaceContent} from "@app/inbox"
  import {navigate} from "@app/modal"
  import {setChecked} from "@app/notifications"
  import {makeSpacePath} from "@app/routes"

  const conversations = $derived($inboxConversations.slice(0, 8))

  const hasUnread = $derived(
    $inboxConversations.some(conversation => conversation.unread) || $inboxSpaceContent.length > 0,
  )

  const displayContent = (countsByKind: Map<number, number>) =>
    [...countsByKind].map(([kind, count]) => displayContentCount(kind, count)).join(" · ")

  const markAllRead = () => setChecked("*")

  const startChat = () => navigate("/chat")
</script>

<HomeSection title="Inbox" icon={Inbox}>
  {#snippet action()}
    {#if hasUnread}
      <Button class="button button-neutral button-xs" onclick={markAllRead}>Mark all read</Button>
    {/if}
  {/snippet}
  {#if conversations.length === 0 && $inboxSpaceContent.length === 0}
    <div class="flex flex-col items-center gap-3 px-4 pb-8 text-center">
      <p class="font-medium">Nothing in your inbox yet</p>
      <p class="max-w-md text-sm opacity-75">
        Rooms and spaces you belong to report their activity here — messages, threads, classifieds,
        events and polls.
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
  {:else}
    <div class="flex flex-col divide-y divide-line border-t border-line">
      {#each conversations as conversation (conversation.path)}
        <HomeInboxItem {conversation} />
      {/each}
      {#each $inboxSpaceContent as { url, countsByKind } (url)}
        <Link
          href={makeSpacePath(url)}
          class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-more">
          <RelayIcon {url} size={6} class="shrink-0" />
          <strong class="truncate"><RelayName {url} /></strong>
          <span class="truncate opacity-75">{displayContent(countsByKind)}</span>
        </Link>
      {/each}
    </div>
  {/if}
</HomeSection>
