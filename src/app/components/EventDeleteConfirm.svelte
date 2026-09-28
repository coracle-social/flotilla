<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Confirm from "@lib/components/Confirm.svelte"
  import {deletes, relays} from "@app/core"
  import {clearModals} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const shouldProtect = $relays.hasNip(url, 70)

  const confirm = async () => {
    const protect = await shouldProtect
    const command = await $deletes.deleteEvent(event, writer => writer.setProtected(protect))
    const error = (await command.publishToRelays([url]).settled()).getError()

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
