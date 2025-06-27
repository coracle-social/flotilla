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
    publishDelete({event: alert.event, relays: [NOTIFIER_RELAY], tags: [["p", NOTIFIER_PUBKEY]]})
    pushToast({message: "Your alert has been deleted!"})
    history.back()
  }
</script>

<Confirm {confirm} message="You'll no longer receive messages for this alert." />
