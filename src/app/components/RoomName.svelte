<script lang="ts">
  import {deriveRoom} from "@app/core/state"

  type Props = {
    url: string
    h: string
    class?: string
  }

  const {url, h, ...props}: Props = $props()

  const room = deriveRoom(url, h)
</script>

<span class="ellipsize {props.class}">
  {$room?.name || h}
</span>
