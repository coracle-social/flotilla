<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {goToSpace} from "@app/util/routes"
  import {PLATFORM_RELAYS} from "@app/core/state"

  onMount(async () => {
    if (PLATFORM_RELAYS.length > 0) {
      goToSpace(PLATFORM_RELAYS[0])
    } else {
      goto("/home")
    }
  })
</script>
