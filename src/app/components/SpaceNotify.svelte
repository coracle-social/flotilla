<script lang="ts">
  import {parse, renderAsHtml} from "@welshman/content"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {dismissRelayNotification, relayNotification} from "@app/notify"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const notification = relayNotification(url)

  const dismiss = () => dismissRelayNotification($notification)
</script>

{#if $notification}
  <div class="space-notify">
    <RelayIcon {url} size={6} />
    <div class="min-w-0 grow">
      <RelayName {url} class="text-sm font-bold" />
      <div class="welshman-content text-sm">
        {@html renderAsHtml(parse({content: $notification.message}))}
      </div>
    </div>
    <Button class="shrink-0 text-content-subtle hover:text-content" onclick={dismiss}>
      <Icon icon={CloseCircle} />
    </Button>
  </div>
{/if}
