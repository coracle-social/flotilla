<script lang="ts">
  import cx from "classnames"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    count: number
    onclick: () => void
    class?: string
  }

  const {count, onclick, ...props}: Props = $props()
</script>

<Button class={cx("button button-neutral button-xs rounded-full", props.class)} {onclick}>
  <Icon icon={Reply} size={4} />
  {#if count === 0}
    Reply
  {:else if count === 1}
    1 reply
  {:else}
    {count} replies
  {/if}
</Button>
