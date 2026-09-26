<script module lang="ts">
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
  import Chat from "@app/components/Chat.svelte"
  import {splitChatId} from "@app/chats"
  import {pushToast} from "@app/toast"
  import {Push, notificationSettings} from "@app/push"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const pubkeys = splitChatId(params.chat)

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
