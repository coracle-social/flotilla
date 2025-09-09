<script lang="ts">
  import {page} from "$app/stores"
  import Chat from "@app/components/Chat.svelte"
  import {notifications, setChecked} from "@app/util/notifications"

  // We have to watch this one, since on mobile the badge will be visible when active
  $effect(() => {
    if ($notifications.has($page.url.pathname)) {
      setChecked($page.url.pathname)
    }
  })
</script>

<Chat id={$page.params.chat} />
