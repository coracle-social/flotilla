<script lang="ts">
  import {stopPropagation} from "svelte/legacy"
  import {PublishStatus} from "@welshman/net"
  import type {BaseThunk} from "@welshman/app"

  type Props = {
    thunk: BaseThunk
    class?: string
  }

  const {thunk, ...restProps}: Props = $props()

  const abort = () => thunk.abort()

  const isSending = $derived($thunk.hasStatus(PublishStatus.Sending))
</script>

<div class="flex w-full justify-end px-1 text-xs {restProps.class}">
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
