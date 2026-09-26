<script lang="ts" module>
  export type SegmentedOption<T> = {value: T; label: string; count?: number}
</script>

<script lang="ts" generics="T">
  import cx from "classnames"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    options: SegmentedOption<T>[]
    value: T
    joined?: boolean
    size?: "xs" | "sm"
    class?: string
  }

  let {options, value = $bindable(), joined, size = "sm", ...props}: Props = $props()

  const select = (option: T) => () => {
    value = option
  }
</script>

<div class={cx(joined ? "join" : "flex items-center gap-2", props.class)}>
  {#each options as option (option.value)}
    <Button
      aria-pressed={value === option.value}
      class={cx(
        "button",
        {"button-xs": size === "xs", "button-sm": size === "sm"},
        joined ? "join-item grow" : "shrink-0 rounded-full",
        value === option.value ? "button-primary" : "button-neutral",
      )}
      onclick={select(option.value)}>
      {option.label}
      {#if option.count !== undefined}
        <span class="opacity-75">{option.count}</span>
      {/if}
    </Button>
  {/each}
</div>
