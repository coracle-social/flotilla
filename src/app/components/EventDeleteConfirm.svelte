<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Confirm from "@lib/components/Confirm.svelte"
  import {publishDelete, canEnforceNip70} from "@app/core/commands"
  import {clearModals} from "@app/util/modal"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const shouldProtect = canEnforceNip70(url)

  const confirm = async () => {
    await publishDelete({event, relays: [url], protect: await shouldProtect})

    clearModals()
  }
</script>

<Confirm
  {confirm}
  title="Delete Message"
  subtitle="Are you sure you want to delete this message?"
  message="This will send a request to delete this message. Be aware that not all relays may honor this request." />
