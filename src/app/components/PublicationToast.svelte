<script lang="ts">
  import type {Publishable} from "@welshman/app"
  import {PublishStatus} from "@welshman/net"
  import PublicationPending from "@app/components/PublicationPending.svelte"
  import type {Toast} from "@app/ui/toast"
  import {popToast} from "@app/ui/toast"

  type Props = {
    toast: Toast
    publication: Publishable
  }

  const {toast, ...props}: Props = $props()

  const id = toast.id
  const publication = props.publication
  const {Aborted, Timeout, Failure} = PublishStatus
  const isFailure = $derived($publication.hasStatus([Aborted, Timeout, Failure]))
  const isComplete = $derived($publication.isComplete())

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
  <PublicationPending {publication} />
{:else if !isFailure}
  <p class="text-xs opacity-75">Message sent!</p>
{/if}
