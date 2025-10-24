<script lang="ts">
  import {deriveRelay} from "@welshman/app"

  const {...props} = $props()

  const relay = deriveRelay(props.url)
</script>

{#if $relay?.description}
  <p class={props.class}>{$relay.description}</p>
{/if}
