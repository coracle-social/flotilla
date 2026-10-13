<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {sleep} from "@welshman/lib"
  import Add from "@assets/icons/add.svg?dataurl"
  import ChatSquarePlus from "@assets/icons/chat-square-plus.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import FAB from "@lib/components/FAB.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SecondaryNavHeader from "@lib/components/SecondaryNavHeader.svelte"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import MessagesMenu from "@app/components/MessagesMenu.svelte"
  import ConversationStart from "@app/components/ConversationStart.svelte"
  import ConversationItem from "@app/components/ConversationItem.svelte"
  import MessagesTabs from "@app/components/MessagesTabs.svelte"
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
    <SecondaryNavHeader>
      Messages
      <div class="flex items-center">
        <Button
          class="button button-ghost button-sm button-circle"
          aria-label="Start New Chat"
          onclick={startConversation}>
          <Icon icon={Add} />
        </Button>
        <MenuButton component={MessagesMenu} aria-label="Chat options" />
      </div>
    </SecondaryNavHeader>
    <label class="input input-sm flex items-center gap-2">
      <Icon icon={Magnifier} />
      <input bind:value={term} class="grow" type="text" />
    </label>
    <MessagesTabs bind:tab {conversationsByTab} />
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
