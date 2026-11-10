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
  import ConversationNotificationsPrompt from "@app/components/ConversationNotificationsPrompt.svelte"
  import Chat from "@app/components/Conversation.svelte"
  import * as pages from "@app/navigation/pages"
  import {pushModal} from "@app/navigation/dialogs"
  import {Push, notificationSettings} from "@app/features/push"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const pubkeys = pages.getConversationPubkeys(pages.conversation.decode(params).pubkeys)

  onMount(async () => {
    await Promise.all([dmNotificationsPrompted.ready, notificationSettings.ready])

    const {push, messages} = notificationSettings.get()

    if (!$dmNotificationsPrompted && !(push && messages)) {
      dmNotificationsPrompted.set(true)

      // A permission that was already refused can't be asked for again, so there's nothing to offer.
      if ((await Push.check()) !== "denied") {
        pushModal(ConversationNotificationsPrompt)
      }
    }
  })
</script>

<Chat {pubkeys} />
