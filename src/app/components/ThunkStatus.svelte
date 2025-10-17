<script lang="ts">
  import type {AbstractThunk} from "@welshman/app"
  import {thunkIsComplete, getFailedThunkUrls} from "@welshman/app"
  import ThunkFailure from "@app/components/ThunkFailure.svelte"
  import ThunkPending from "@app/components/ThunkPending.svelte"

  interface Props {
    thunk: AbstractThunk
    class?: string
  }

  const {thunk, ...restProps}: Props = $props()

  const showFailure = $derived(thunkIsComplete($thunk) && getFailedThunkUrls($thunk).length > 0)
  const showPending = $derived(!thunkIsComplete($thunk))
</script>

{#if showFailure}
  <ThunkFailure class={restProps.class} {thunk} />
{:else if showPending}
  <ThunkPending class={restProps.class} {thunk} />
{/if}
