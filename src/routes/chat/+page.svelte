<script lang="ts">
  import InfoCircle from "@assets/icons/info-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import ContentSearch from "@lib/components/ContentSearch.svelte"
  import ConversationItem from "@app/components/ConversationItem.svelte"
  import ConversationStart from "@app/components/ConversationStart.svelte"
  import MessagesMenu from "@app/components/MessagesMenu.svelte"
  import MessagesTabs from "@app/components/MessagesTabs.svelte"
  import {
    MessagesTab,
    messagesContext,
    conversationSearch,
    groupConversationsByTab,
  } from "@app/features/messages"
  import {pushModal} from "@app/navigation/dialogs"

  let term = $state("")
  let tab = $state(MessagesTab.Conversations)

  const startConversation = () => pushModal(ConversationStart)

  const conversations = $derived($conversationSearch.searchOptions(term))
  const conversationsByTab = $derived(groupConversationsByTab(conversations, $messagesContext))
</script>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  <div class="hidden min-h-screen md:flex flex-col gap-2 m-auto items-center py-20">
    <p class="flex gap-2 text-lg">
      <Icon icon={InfoCircle} />
      No conversation selected.
    </p>
    <p>
      Click on a conversation in the sidebar, or <Button class="link" onclick={startConversation}
        >start a new one</Button
      >.
    </p>
  </div>
  <ContentSearch class="md:hidden">
    {#snippet input()}
      <div class="flex flex-col gap-2 min-w-0 grow">
        <div class="flex gap-2 min-w-0 items-center">
          <label class="input input-group flex grow items-center gap-2">
            <Icon icon={Magnifier} />
            <input
              bind:value={term}
              class="grow"
              type="text"
              placeholder="Search for conversations..." />
          </label>
          <MenuButton
            component={MessagesMenu}
            class="button button-neutral"
            aria-label="Chat options" />
        </div>
        <MessagesTabs bind:tab {conversationsByTab} />
      </div>
    {/snippet}
    {#snippet content()}
      <div class="flex flex-col gap-2">
        {#each conversationsByTab[tab] as { id, pubkeys, messages } (id)}
          <ConversationItem {id} {pubkeys} {messages} class="card" />
        {:else}
          <div class="py-20 max-w-sm flex flex-col gap-4 items-center m-auto text-center">
            {#if tab === MessagesTab.Requests}
              <p>No message requests.</p>
            {:else}
              <p>No chats found! Try starting one up.</p>
              <Button class="button button-primary" onclick={startConversation}>
                <Icon icon={AddCircle} />
                Start a Chat
              </Button>
            {/if}
          </div>
        {/each}
      </div>
    {/snippet}
  </ContentSearch>
</PageContent>
