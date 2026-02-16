<script>
  import {page} from "$app/stores"
</script>

{#key $page.url.searchParams.get("at")}
  <slot />
{/key}
