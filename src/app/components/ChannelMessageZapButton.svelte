<script lang="ts">
  import Icon from "@lib/components/Icon.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"

  const {url, event} = $props()
</script>

<ZapButton {url} {event} class="btn join-item btn-xs">
  <Icon icon="bolt" size={4} />
</ZapButton>
