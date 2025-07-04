<script lang="ts">
  import {page} from "$app/stores"
  import {onDestroy} from "svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ContentSearch from "@lib/components/ContentSearch.svelte"
  import ChatItem from "@app/components/ChatItem.svelte"
  import ChatStart from "@app/components/ChatStart.svelte"
  import ChatMenu from "@app/components/ChatMenu.svelte"
  import {chatSearch} from "@app/state"
  import {pushModal} from "@app/modal"
  import {setChecked} from "@app/notifications"

  let term = $state("")

  const startChat = () => pushModal(ChatStart)

  const openMenu = () => pushModal(ChatMenu)

  const chats = $derived($chatSearch.searchOptions(term))

  onDestroy(() => {
    setChecked($page.url.pathname)
  })
</script>

<div class="hidden min-h-screen md:hero">
  <div class="col-2 hero-content text-center">
    <p class="row-2 text-lg">
      <Icon icon="info-circle" />
      No conversation selected.
    </p>
    <p>
      Click on a conversation in the sidebar, or <Button class="link" onclick={startChat}
        >start a new one</Button
      >.
    </p>
  </div>
</div>

<ContentSearch class="md:hidden">
  {#snippet input()}
    <div class="row-2 min-w-0 flex-grow items-center">
      <label class="input input-bordered flex flex-grow items-center gap-2">
        <Icon icon="magnifer" />
        <input
          bind:value={term}
          class="grow"
          type="text"
          placeholder="Search for conversations..." />
      </label>
      <Button class="btn btn-primary" onclick={openMenu}>
        <Icon icon="menu-dots" />
      </Button>
    </div>
  {/snippet}
  {#snippet content()}
    <div class="col-2">
      {#each chats as { id, pubkeys, messages } (id)}
        <ChatItem {id} {pubkeys} {messages} class="bg-alt card2" />
      {:else}
        <div class="py-20 max-w-sm col-4 items-center m-auto text-center">
          <p>No chats found! Try starting one up.</p>
          <Button class="btn btn-primary" onclick={startChat}>
            <Icon icon="add-circle" />
            Start a Chat
          </Button>
        </div>
      {/each}
    </div>
  {/snippet}
</ContentSearch>
