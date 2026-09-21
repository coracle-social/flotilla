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
  import ChatMenu from "@app/components/ChatMenu.svelte"
  import ChatStart from "@app/components/ChatStart.svelte"
  import ChatItem from "@app/components/ChatItem.svelte"
  import ChatTabs from "@app/components/ChatTabs.svelte"
  import {ChatTab, chatContext, chatSearch, groupChatsByTab} from "@app/chats"
  import {pushModal} from "@app/modal"
  import {shouldUnwrap} from "@app/sync"
  import type {LayoutProps} from "./$types"

  const {children, params}: LayoutProps = $props()

  const startChat = () => pushModal(ChatStart)

  let term = $state("")
  let tab = $state(ChatTab.Conversations)

  const chats = $derived($chatSearch.searchOptions(term))
  const chatsByTab = $derived(groupChatsByTab(chats, $chatContext))

  const promise = sleep(10000)

  onMount(() => {
    shouldUnwrap.set(true)
  })
</script>

<SecondaryNav class="relative w-72 lg:w-80">
  <SecondaryNavSection>
    <SecondaryNavHeader>
      Chats
      <div class="flex items-center">
        <Button
          class="button button-ghost button-sm button-circle"
          aria-label="Start New Chat"
          onclick={startChat}>
          <Icon icon={Add} />
        </Button>
        <MenuButton component={ChatMenu} aria-label="Chat options" />
      </div>
    </SecondaryNavHeader>
    <label class="input input-sm flex items-center gap-2">
      <Icon icon={Magnifier} />
      <input bind:value={term} class="grow" type="text" />
    </label>
    <ChatTabs bind:tab {chatsByTab} />
  </SecondaryNavSection>
  <div class="overflow-auto">
    {#each chatsByTab[tab] as { id, pubkeys, messages } (id)}
      <ChatItem {id} {pubkeys} {messages} />
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
  <FAB onclick={startChat}>
    <Icon icon={ChatSquarePlus} size={7} />
  </FAB>
{/if}
