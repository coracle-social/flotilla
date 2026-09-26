<script lang="ts">
  import cx from "classnames"
  import type {TrustedEvent} from "@welshman/util"
  import {Classified} from "@welshman/domain"
  import {ucFirst} from "@lib/util"
  import {reader} from "@app/core"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const status = $derived(reader(Classified)(event).status())
</script>

{#if status}
  <span
    class={cx("badge badge-sm rounded-full", {
      "badge-primary": status !== "active",
      "badge-neutral": status === "active",
    })}>
    {ucFirst(status)}
  </span>
{/if}
