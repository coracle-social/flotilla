<script lang="ts">
  import cx from "classnames"
  import Button from "@lib/components/Button.svelte"
  import {CHAT_TABS, ChatTab} from "@app/chats"
  import type {ChatsByTab} from "@app/chats"

  interface Props {
    tab: ChatTab
    chatsByTab: ChatsByTab
    class?: string
  }

  let {tab = $bindable(), chatsByTab, ...props}: Props = $props()

  const setTab = (value: ChatTab) => () => {
    tab = value
  }
</script>

<div class={cx("flex items-center gap-2", props.class)}>
  {#each CHAT_TABS as { value, label } (value)}
    <Button
      aria-pressed={tab === value}
      class={cx(
        "button button-sm shrink-0 rounded-full",
        tab === value ? "button-primary" : "button-neutral",
      )}
      onclick={setTab(value)}>
      {label}
      <span class="opacity-75">{chatsByTab[value].length}</span>
    </Button>
  {/each}
</div>
