<script lang="ts">
  import {page} from "$app/stores"
  import type {MakeNonOptional} from "@welshman/lib"
  import {append, uniq} from "@welshman/lib"
  import {pubkey} from "@welshman/app"
  import Chat from "@app/components/Chat.svelte"
  import {splitChatId} from "@app/core/state"

  const {chat} = $page.params as MakeNonOptional<typeof $page.params>
  const pubkeys = uniq(append($pubkey!, splitChatId(chat)))
</script>

<Chat {pubkeys} />
