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
  class={cx("bg-surface-more text-content w-full rounded px-1 text-sm", {
    "overflow-auto whitespace-nowrap": singleLine,
    "block overflow-x-auto whitespace-pre": !singleLine && isBlock,
    "whitespace-pre-wrap wrap-anywhere": !singleLine && !isBlock,
  })}>
  {value.trim()}
</code>
