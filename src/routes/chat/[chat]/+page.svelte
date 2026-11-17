<script module lang="ts">
  import {synced} from "@welshman/store"
  import {isBlocked} from "@lib/push/permission"
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
  import {alertSettings} from "@app/tools/alerts/settings"
  import {checkPushPermission} from "@app/features/push"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const pubkeys = pages.getConversationPubkeys(pages.conversation.decode(params).pubkeys)

  onMount(async () => {
    await Promise.all([dmNotificationsPrompted.ready, alertSettings.ready])

    const {push, messages} = alertSettings.get()

    if (!$dmNotificationsPrompted && !(push && messages)) {
      dmNotificationsPrompted.set(true)

      // A permission that was already refused can't be asked for again, so there's nothing to offer.
      if (!isBlocked(await checkPushPermission())) {
        pushModal(ConversationNotificationsPrompt)
      }
    }
  })
</script>

<Chat {pubkeys} />
