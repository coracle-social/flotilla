<script context="module" lang="ts">
  import {synced} from "@welshman/store"
  import {kv} from "@app/storage"

  const dmNotificationsPrompted = synced({
    key: "dmNotificationsPrompted",
    defaultValue: false,
    storage: kv,
  })
</script>

<script lang="ts">
  import {onMount} from "svelte"
  import {append, uniq} from "@welshman/lib"
  import Chat from "@app/components/Chat.svelte"
  import {splitChatId} from "@app/chats"
  import {notificationSettings} from "@app/settings"
  import {pushToast} from "@app/toast"
  import {Push} from "@app/push"
  import {user} from "@app/core"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {chat} = params
  const pubkeys = uniq(append($user.pubkey, splitChatId(chat)))

  onMount(async () => {
    if (!$dmNotificationsPrompted) {
      dmNotificationsPrompted.set(true)

      const permission = await Push.request()

      if (!permission.startsWith("granted")) {
        return pushToast({
          theme: "error",
          message: `Failed to request notification permissions (${permission}).`,
        })
      }

      notificationSettings.update(current => ({
        ...current,
        push: true,
        messages: true,
      }))

      pushToast({message: "Notifications enabled!"})
    }
  })
</script>

<Chat {pubkeys} />
