<script lang="ts">
  import {channelsById, makeChannelId} from "@app/core/state"

  const {url, h} = $props()
</script>

{$channelsById.get(makeChannelId(url, h))?.name || h}
