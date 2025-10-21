<script lang="ts">
  import StatusIndicator from "@lib/components/StatusIndicator.svelte"
  import {deriveSocketStatus} from "@app/core/state"

  type Props = {
    url: string
  }

  const {url}: Props = $props()
  const status = deriveSocketStatus(url)
</script>

<StatusIndicator class="bg-{$status.theme}">{$status.title}</StatusIndicator>
