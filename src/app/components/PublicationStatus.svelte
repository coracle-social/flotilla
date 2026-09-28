<script lang="ts">
  import type {Publishable} from "@welshman/app"
  import PublicationFailure from "@app/components/PublicationFailure.svelte"
  import PublicationPending from "@app/components/PublicationPending.svelte"

  type Props = {
    publication: Publishable
    showToastOnRetry?: boolean
    inline?: boolean
    class?: string
  }

  const {publication, showToastOnRetry, inline = false, ...restProps}: Props = $props()

  const showFailure = $derived($publication.isComplete() && $publication.getFailedUrls().length > 0)
  const showPending = $derived(!$publication.isComplete())
</script>

{#if showFailure}
  <PublicationFailure class={restProps.class} {publication} {showToastOnRetry} {inline} />
{:else if showPending}
  <PublicationPending class={restProps.class} {publication} {inline} />
{/if}
