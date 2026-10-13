<script lang="ts">
  import Content from "@app/components/Content.svelte"
  import {relays} from "@app/core/plugins"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = $relays.one(url)
</script>

{#if $relay?.description}
  <Content event={{content: $relay.description, tags: []}} />
{/if}
