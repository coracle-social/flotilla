<script lang="ts">
  import {page} from "$app/stores"
  import type {MakeNonOptional} from "@welshman/lib"
  import {append, uniq} from "@welshman/lib"
  import {pubkey} from "@welshman/app"
  import Chat from "@app/components/Chat.svelte"
  import {notifications, setChecked} from "@app/util/notifications"
  import {splitChatId} from "@app/core/state"

  const {chat} = $page.params as MakeNonOptional<typeof $page.params>
  const pubkeys = uniq(append($pubkey!, splitChatId(chat)))

  // We have to watch this one, since on mobile the badge will be visible when active
  $effect(() => {
    if ($notifications.has($page.url.pathname)) {
      setChecked($page.url.pathname)
    }
  })
</script>

<Chat {pubkeys} />
