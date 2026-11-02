<script lang="ts">
  import {rooms} from "@app/core/plugins"

  type Props = {
    url: string
    h: string
    class?: string
  }

  const {url, h, ...props}: Props = $props()

  const room = $rooms.forRoom(url, h)
</script>

<span class="truncate min-w-0 {props.class}">
  {$room?.meta?.name() || h}
</span>
