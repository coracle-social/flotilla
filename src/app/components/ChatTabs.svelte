<script lang="ts">
  import SegmentedButtons from "@lib/components/SegmentedButtons.svelte"
  import {CHAT_TABS, ChatTab} from "@app/chats"
  import type {ChatsByTab} from "@app/chats"

  type Props = {
    tab: ChatTab
    chatsByTab: ChatsByTab
    class?: string
  }

  let {tab = $bindable(), chatsByTab, ...props}: Props = $props()

  const options = $derived(
    CHAT_TABS.map(({value, label}) => ({value, label, count: chatsByTab[value].length})),
  )
</script>

<SegmentedButtons {options} bind:value={tab} class={props.class} />
