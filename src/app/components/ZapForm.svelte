<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import {zapAmounts} from "@app/core/settings"

  export type Values = {
    amount: number
    content: string
  }

  type Props = {
    amount: number
    content: string
    children?: Snippet
  }

  let {amount = $bindable(), content = $bindable(), children}: Props = $props()

  const onEmoji = (emoji: string) => {
    content = emoji
  }

  const selectAmount = (preset: number) => () => {
    amount = preset
  }
</script>

<div class="flex flex-col gap-6">
  <Field>
    {#snippet label()}
      <p>Amount (sats)</p>
    {/snippet}
    {#snippet secondary()}
      <EmojiButton {onEmoji} class="button button-neutral button-sm h-10 w-10 text-xl">
        {content}
      </EmojiButton>
    {/snippet}
    {#snippet input()}
      <label class="input flex w-full items-center gap-2">
        <Icon icon={Bolt} />
        <input bind:value={amount} type="number" class="min-w-0 grow" />
        <p class="shrink-0 opacity-50">sats</p>
      </label>
    {/snippet}
  </Field>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {#each $zapAmounts as preset, i (i)}
      <Button
        class={cx("button button-sm", {
          "button-primary": preset === amount,
          "button-neutral": preset !== amount,
        })}
        onclick={selectAmount(preset)}>
        {preset}
      </Button>
    {/each}
  </div>
  {@render children?.()}
</div>
