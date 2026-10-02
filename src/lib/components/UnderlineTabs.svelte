<script lang="ts" module>
  export type UnderlineTab<T> = {value: T; label: string; icon?: string; notification?: boolean}
</script>

<script lang="ts" generics="T">
  import cx from "classnames"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {fade} from "@lib/transition"

  type Props = {
    options: UnderlineTab<T>[]
    value: T
    class?: string
  }

  let {options, value = $bindable(), ...props}: Props = $props()

  const select = (option: T) => () => {
    value = option
  }
</script>

<div class={cx("flex min-w-0 items-end gap-4", props.class)}>
  {#each options as option (option.value)}
    <Button
      aria-pressed={value === option.value}
      class={cx(
        "relative flex shrink-0 items-center gap-2 border-b-2 pt-1 pb-3 text-base font-bold transition-colors",
        value === option.value
          ? "border-primary"
          : "border-transparent text-content-muted hover:text-content",
      )}
      onclick={select(option.value)}>
      {#if option.icon}
        <Icon icon={option.icon} size={5} />
      {/if}
      {option.label}
      {#if option.notification}
        <span
          role="img"
          aria-label="Unread"
          class="absolute top-1 -right-2 h-2 w-2 rounded-full bg-primary"
          transition:fade></span>
      {/if}
    </Button>
  {/each}
</div>
