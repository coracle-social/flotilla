<script lang="ts">
  import {deriveRelayDisplay} from "@welshman/app"

  const {url} = $props()

  const display = $derived(deriveRelayDisplay(url))
</script>

{$display}
