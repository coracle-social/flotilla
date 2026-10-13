<script lang="ts">
  import {page} from "$app/stores"
  import {goToHome} from "@app/ui/routes"

  // Depend on the page so the redirect runs again instead of only on mount.
  $effect(() => {
    void $page

    goToHome()
  })
</script>
