<script lang="ts">
  import Confirm from "@lib/components/Confirm.svelte"
  import type {Alert} from "@app/state"
  import {NOTIFIER_RELAY, NOTIFIER_PUBKEY} from "@app/state"
  import {publishDelete} from "@app/commands"
  import {pushToast} from "@app/toast"

  type Props = {
    alert: Alert
  }

  const {alert}: Props = $props()

  const confirm = () => {
    const relays = [NOTIFIER_RELAY]
    const tags = [["p", NOTIFIER_PUBKEY]]

    publishDelete({event: alert.event, relays, tags, protect: false})
    pushToast({message: "Your alert has been deleted!"})
    history.back()
  }
</script>

<Confirm {confirm} message="You'll no longer receive messages for this alert." />
