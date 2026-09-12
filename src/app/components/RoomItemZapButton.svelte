<script lang="ts">
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"

  const {url, event} = $props()
</script>

<ZapButton aria-label="Send a zap" {url} {event} class="button button-xs button-neutral join-item">
  <Icon icon={Bolt} size={4} />
</ZapButton>
