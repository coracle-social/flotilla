<script lang="ts">
  import {seen} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {Delete} from "@welshman/domain"
  import {publishToRelays} from "@welshman/app"
  import Confirm from "@lib/components/Confirm.svelte"
  import {deletes, router} from "@app/core/plugins"
  import {writer} from "@app/core/domain"
  import {PublishBuilder} from "@app/tools/publish"
  import {HIDE_NOSTR} from "@app/core/env"
  import {clearModals} from "@app/navigation/dialogs"
  import {pushToast} from "@app/navigation/toast"

  type Props = {
    url?: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  // A deletion goes where its subject lives: the space's own relay, or wherever the event was seen.
  // Outside a space it isn't protected, since NIP-70 would keep it on the one relay that accepts it.
  const publishDeletion = async () => {
    if (url) {
      return new PublishBuilder(writer(Delete).addEvent(event, url)).toSpace(url).publish()
    }

    const relays = await $router.resolver.relays([seen(event)])

    return $deletes.deleteEvent(event).then(publishToRelays(relays))
  }

  const confirm = async () => {
    const publication = await publishDeletion()
    const error = await publication.getFatalError()

    if (error) {
      return pushToast({theme: "error", message: error})
    }

    clearModals()
  }
</script>

<Confirm
  {confirm}
  title="Delete Message"
  subtitle="Are you sure you want to delete this message?"
  message={HIDE_NOSTR
    ? "This will delete this message for everyone."
    : "This will send a request to delete this message. Be aware that not all relays may honor this request."} />
