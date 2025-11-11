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

<ImageIcon
  {size}
  src={$relay?.icon || RemoteControllerMinimalistic}
  alt="Relay image"
  class={props.class} />
