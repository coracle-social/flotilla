<script lang="ts">
  import Bolt from "@assets/icons/bolt.svg?dataurl"
import Icon from "@lib/components/Icon.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"

  const {url, event} = $props()
</script>

<ZapButton {url} {event} class="btn join-item btn-xs">
  <Icon icon={Bolt} size={4} />
</ZapButton>
