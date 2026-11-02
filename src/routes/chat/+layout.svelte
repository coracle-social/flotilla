<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {sleep} from "@welshman/lib"
  import ChatSquarePlus from "@assets/icons/chat-square-plus.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import FAB from "@lib/components/FAB.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import ConversationStart from "@app/components/ConversationStart.svelte"
  import ConversationItem from "@app/components/ConversationItem.svelte"
  import MessagesHeader from "@app/components/MessagesHeader.svelte"
  import {
    MessagesTab,
    messagesContext,
    conversationSearch,
    groupConversationsByTab,
  } from "@app/features/messages"
  import {pushModal} from "@app/navigation/dialogs"
  import {shouldUnwrap} from "@app/features/messages"
  import type {LayoutProps} from "./$types"

  const {children, params}: LayoutProps = $props()

  const startConversation = () => pushModal(ConversationStart)

  let term = $state("")
  let tab = $state(MessagesTab.Conversations)

  const conversations = $derived($conversationSearch.searchOptions(term))
  const conversationsByTab = $derived(groupConversationsByTab(conversations, $messagesContext))

  const promise = sleep(10000)

  onMount(() => {
    shouldUnwrap.set(true)
  })
</script>

<SecondaryNav class="relative w-72 lg:w-80">
  <SecondaryNavSection>
    <MessagesHeader bind:term bind:tab {conversationsByTab} />
  </SecondaryNavSection>
  <div class="overflow-auto">
    {#each conversationsByTab[tab] as { id, pubkeys, messages } (id)}
      <ConversationItem {id} {pubkeys} {messages} />
    {/each}
    {#await promise}
      <div class="divider"></div>
      <div class="px-6 py-4 text-xs">
        <Spinner loading>Loading conversations...</Spinner>
      </div>
    {/await}
  </div>
</SecondaryNav>
<Page>
  {#key $page.url.pathname}
    {@render children?.()}
  {/key}
</Page>

{#if !params.chat}
  <FAB onclick={startConversation}>
    <Icon icon={ChatSquarePlus} size={7} />
  </FAB>
{/if}
