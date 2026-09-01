<script lang="ts">
  import InfoCircle from "@assets/icons/info-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Button from "@lib/components/Button.svelte"
  import ContentSearch from "@lib/components/ContentSearch.svelte"
  import ChatItem from "@app/components/ChatItem.svelte"
  import ChatStart from "@app/components/ChatStart.svelte"
  import ChatMenu from "@app/components/ChatMenu.svelte"
  import {chatSearch} from "@app/chats"
  import {pushModal} from "@app/modal"

  let term = $state("")

  const startChat = () => pushModal(ChatStart)

  const openMenu = () => pushModal(ChatMenu)

  const chats = $derived($chatSearch.searchOptions(term))
</script>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  <div class="hidden min-h-screen md:flex flex-col gap-2 m-auto items-center py-20">
    <p class="flex gap-2 text-lg">
      <Icon icon={InfoCircle} />
      No conversation selected.
    </p>
    <p>
      Click on a conversation in the sidebar, or <Button class="link" onclick={startChat}
        >start a new one</Button
      >.
    </p>
  </div>
  <ContentSearch class="md:hidden">
    {#snippet input()}
      <div class="flex gap-2 min-w-0 grow items-center">
        <label class="input input-group flex grow items-center gap-2">
          <Icon icon={Magnifier} />
          <input
            bind:value={term}
            class="grow"
            type="text"
            placeholder="Search for conversations..." />
        </label>
        <Button class="button button-neutral" onclick={openMenu}>
          <Icon icon={MenuDots} />
        </Button>
      </div>
    {/snippet}
    {#snippet content()}
      <div class="flex flex-col gap-2">
        {#each chats as { id, pubkeys, messages } (id)}
          <ChatItem {id} {pubkeys} {messages} class="card" />
        {:else}
          <div class="py-20 max-w-sm flex flex-col gap-4 items-center m-auto text-center">
            <p>No chats found! Try starting one up.</p>
            <Button class="button button-primary" onclick={startChat}>
              <Icon icon={AddCircle} />
              Start a Chat
            </Button>
          </div>
        {/each}
      </div>
    {/snippet}
  </ContentSearch>
</PageContent>
