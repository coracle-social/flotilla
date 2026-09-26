<script lang="ts">
  import cx from "classnames"

  type Props = {
    value: string
    isBlock: boolean
  }

  const {value, isBlock}: Props = $props()
</script>

<code
  class={cx(
    "bg-surface-more text-content w-full overflow-auto whitespace-pre rounded px-1 text-sm",
    {
      block: isBlock,
    },
  )}>
  {value.trim()}
</code>
