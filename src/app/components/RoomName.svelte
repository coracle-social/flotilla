<script lang="ts">
  import {roomsById, makeRoomId} from "@app/core/state"

  const {url, h} = $props()
</script>

{$roomsById.get(makeRoomId(url, h))?.name || h}
