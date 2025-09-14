<script lang="ts">
  import {stopPropagation} from "svelte/legacy"
  import {PublishStatus} from "@welshman/net"
  import type {AbstractThunk} from "@welshman/app"
  import {abortThunk, thunkHasStatus} from "@welshman/app"

  interface Props {
    thunk: AbstractThunk
    class?: string
  }

  const {thunk, ...restProps}: Props = $props()

  const abort = () => abortThunk(thunk)

  const isSending = $derived(thunkHasStatus(PublishStatus.Sending, $thunk))
</script>

<div class="flex w-full justify-end px-1 text-xs {restProps.class}">
  <span class="flex items-center gap-1">
    <span class="loading loading-spinner mx-1 h-3 w-3 translate-y-px"></span>
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
