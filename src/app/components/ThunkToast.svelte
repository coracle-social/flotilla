<script lang="ts">
  import type {AbstractThunk} from "@welshman/app"
  import {thunkHasStatus, thunkIsComplete} from "@welshman/app"
  import {PublishStatus} from "@welshman/net"
  import ThunkPending from "@app/components/ThunkPending.svelte"
  import type {Toast} from "@app/toast"
  import {popToast} from "@app/toast"

  type Props = {
    toast: Toast
    thunk: AbstractThunk
  }

  const {toast, ...props}: Props = $props()

  const id = toast.id
  const thunk = props.thunk
  const {Aborted, Timeout, Failure} = PublishStatus
  const isFailure = $derived(thunkHasStatus([Aborted, Timeout, Failure], $thunk))
  const isComplete = $derived(thunkIsComplete($thunk))

  $effect(() => {
    if (isFailure) {
      popToast(id)
    }
  })

  $effect(() => {
    if (isComplete) {
      setTimeout(() => popToast(id), 2000)
    }
  })
</script>

{#if !isComplete}
  <ThunkPending {thunk} />
{:else if !isFailure}
  <p class="text-xs opacity-75">Message sent!</p>
{/if}
