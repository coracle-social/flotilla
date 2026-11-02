<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {goToHome} from "@app/navigation/history"
  import {shareFromNative} from "@app/features/share"

  const params = Object.fromEntries($page.url.searchParams)

  onMount(async () => {
    await goToHome()

    shareFromNative(params)
  })
</script>
