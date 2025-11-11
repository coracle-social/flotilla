<script lang="ts">
  import {deriveRelayDisplay} from "@welshman/app"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const display = $derived(deriveRelayDisplay(url))
</script>

{$display}
