<script lang="ts">
  import {seen} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Confirm from "@lib/components/Confirm.svelte"
  import {deletes, relays, router} from "@app/core/plugins"
  import {clearModals} from "@app/navigation/dialogs"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    url?: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  // A deletion goes where its subject lives: the space's own relay, or wherever the event was seen.
  const getRelays = () => (url ? [url] : $router.resolver.relays([seen(event)]))

  const confirm = async () => {
    // NIP-70 keeps a deletion on the one relay that accepts it, which is wrong for a note on several.
    const relay = url ? await $relays.load(url) : undefined
    const command = await $deletes.deleteEvent(event, writer =>
      writer.setProtected(relay?.hasNip(70)),
    )
    const error = await command.publishToRelays(await getRelays()).getError()

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
  message="This will send a request to delete this message. Be aware that not all relays may honor this request." />
