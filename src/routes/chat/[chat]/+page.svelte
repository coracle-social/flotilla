<script module lang="ts">
  import {synced} from "@welshman/store"
  import {kv} from "@app/core/storage"

  const dmNotificationsPrompted = synced({
    key: "dmNotificationsPrompted",
    defaultValue: false,
    storage: kv,
  })
</script>

<script lang="ts">
  import {onMount} from "svelte"
  import Chat from "@app/components/Conversation.svelte"
  import * as pages from "@app/navigation/pages"
  import {pushToast} from "@app/ui/toast"
  import {Push, notificationSettings} from "@app/features/push"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const pubkeys = pages.getConversationPubkeys(pages.conversation.decode(params).pubkeys)

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
