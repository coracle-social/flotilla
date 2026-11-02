<script lang="ts" module>
  export type SegmentedOption<T> = {value: T; label: string; count?: number}
</script>

<script lang="ts" generics="T">
  import cx from "classnames"
  import SegmentedButton from "@lib/components/SegmentedButton.svelte"

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
    <SegmentedButton
      label={option.label}
      count={option.count}
      pressed={value === option.value}
      onclick={select(option.value)}
      {joined}
      {size} />
  {/each}
</div>
