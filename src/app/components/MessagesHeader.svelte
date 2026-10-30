<script lang="ts">
  import Add from "@assets/icons/add.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import SegmentedButtons from "@lib/components/SegmentedButtons.svelte"
  import ConversationStart from "@app/components/ConversationStart.svelte"
  import MessagesMenu from "@app/components/MessagesMenu.svelte"
  import {MESSAGES_TABS, MessagesTab} from "@app/features/messages"
  import type {ConversationsByTab} from "@app/features/messages"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    term: string
    tab: MessagesTab
    conversationsByTab: ConversationsByTab
    actions?: boolean
  }

  let {term = $bindable(), tab = $bindable(), conversationsByTab, actions = true}: Props = $props()

  const startConversation = () => pushModal(ConversationStart)

  const options = $derived(
    MESSAGES_TABS.map(({value, label}) => ({
      value,
      label,
      count: conversationsByTab[value].length,
    })),
  )
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-1">
    <label class="input input-sm input-subtle input-group min-w-0">
      <Icon icon={Magnifier} size={4} />
      <input bind:value={term} type="text" placeholder="Search conversations..." />
    </label>
    {#if actions}
      <Button
        class="button button-ghost button-sm button-circle shrink-0"
        aria-label="Start New Conversation"
        onclick={startConversation}>
        <Icon icon={Add} />
      </Button>
      <MenuButton
        class="button button-ghost button-sm button-circle shrink-0"
        component={MessagesMenu}
        aria-label="Chat options" />
    {/if}
  </div>
  <SegmentedButtons {options} bind:value={tab} joined />
</div>
