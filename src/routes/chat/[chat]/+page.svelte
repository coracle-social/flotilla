<script lang="ts">
  import {page} from "$app/stores"
  import Chat from "@app/components/Chat.svelte"
</script>

<Chat id={$page.params.chat} />
