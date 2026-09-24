<script lang="ts">
  import cx from "classnames"
  import {stopPropagation} from "svelte/legacy"
  import {PublishStatus} from "@welshman/net"
  import type {BaseThunk} from "@welshman/app"

  type Props = {
    thunk: BaseThunk
    // A standalone usage fills its own row, and forcing that inside a flex row costs that row a line.
    inline?: boolean
    class?: string
  }

  const {thunk, inline = false, ...restProps}: Props = $props()

  const abort = () => thunk.abort()

  const isSending = $derived($thunk.hasStatus(PublishStatus.Sending))
</script>

<div class={cx("flex px-1 text-xs", {"w-full justify-end": !inline}, restProps.class)}>
  <span class="flex items-center gap-1">
    <span class="spinner spinner-xs mx-1 translate-y-px"></span>
    <span class="opacity-50">Sending...</span>
    <button
      type="button"
      class="underline transition-all"
      class:link={isSending}
      class:opacity-25={!isSending}
      class:pointer-events-none={!isSending}
      onclick={stopPropagation(abort)}>
      Cancel
    </button>
  </span>
</div>
