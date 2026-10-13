<script lang="ts">
  import SegmentedButtons from "@lib/components/SegmentedButtons.svelte"
  import {MESSAGES_TABS, MessagesTab} from "@app/features/messages"
  import type {ConversationsByTab} from "@app/features/messages"

  type Props = {
    tab: MessagesTab
    conversationsByTab: ConversationsByTab
    class?: string
  }

  let {tab = $bindable(), conversationsByTab, ...props}: Props = $props()

  const options = $derived(
    MESSAGES_TABS.map(({value, label}) => ({
      value,
      label,
      count: conversationsByTab[value].length,
    })),
  )
</script>

<SegmentedButtons {options} bind:value={tab} class={props.class} />
