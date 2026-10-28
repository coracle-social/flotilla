<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {onMount} from "svelte"
  import {POLL_RESPONSE} from "@welshman/util"
  import {Poll} from "@welshman/domain"
  import PollVotes from "@app/components/PollVotes.svelte"
  import Content from "@app/components/Content.svelte"
  import {network} from "@app/core/plugins"
  import {reader} from "@app/core/domain"

  const props: ComponentProps<typeof Content> = $props()

  // A poll outside a space names the relays its votes live on itself, per NIP-88.
  const urls = $derived(props.url ? [props.url] : reader(Poll)(props.event).urls())

  onMount(() => {
    if (urls.length > 0) {
      $network.request({
        relays: urls,
        filters: [{kinds: [POLL_RESPONSE], "#e": [props.event.id]}],
      })
    }
  })
</script>

<div class="flex flex-col gap-3">
  <Content event={props.event} showEntire url={props.url} />

  {#if urls.length > 0}
    <PollVotes {urls} event={props.event} />
  {/if}
</div>
