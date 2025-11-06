<script lang="ts">
  import {roomsById, makeRoomId} from "@app/core/state"

  const {url, h} = $props()
</script>

<span class="ellipsize">
  {$roomsById.get(makeRoomId(url, h))?.name || h}
</span>
