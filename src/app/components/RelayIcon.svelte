<script lang="ts">
  import {deriveRelay} from "@welshman/app"
  import RemoteControllerMinimalistic from "@assets/icons/remote-controller-minimalistic.svg?dataurl"
  import ImageIcon from "@lib/components/ImageIcon.svelte"

  type Props = {
    url: string
    size?: number
    class?: string
  }

  const {url, size = 7, ...props}: Props = $props()

  const relay = deriveRelay(url)
</script>

{#if $relay?.icon}
  <ImageIcon {size} alt="" src={$relay?.icon} class={props.class} />
{:else}
  <ImageIcon size={size - 2} alt="" src={RemoteControllerMinimalistic} class={props.class} />
{/if}
