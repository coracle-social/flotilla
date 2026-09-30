<script lang="ts">
  import cx from "classnames"

  type Props = {
    value: string
    isBlock: boolean
    singleLine?: boolean
  }

  const {value, isBlock, singleLine = false}: Props = $props()
</script>

<code
  class={cx(
    "bg-surface-more text-content w-full overflow-auto rounded px-1 text-sm",
    singleLine ? "whitespace-nowrap" : "whitespace-pre",
    {
      block: isBlock,
    },
  )}>
  {value.trim()}
</code>
