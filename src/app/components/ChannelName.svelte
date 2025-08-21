<script lang="ts">
  import {channelsById, makeChannelId} from "@app/core/state"

  const {url, room} = $props()
</script>

{$channelsById.get(makeChannelId(url, room))?.name || room}
