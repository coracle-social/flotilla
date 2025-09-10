<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {makeSpacePath} from "@app/util/routes"
  import {PLATFORM_RELAYS} from "@app/core/state"

  onMount(() => {
    if (PLATFORM_RELAYS.length > 0) {
      goto(makeSpacePath(PLATFORM_RELAYS[0]))
    } else {
      goto("/home")
    }
  })
</script>
