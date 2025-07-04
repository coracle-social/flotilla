<script lang="ts">
  import Confirm from "@lib/components/Confirm.svelte"
  import {wallet} from "@app/state"
  import {clearModals} from "@app/modal"

  const confirm = async () => {
    wallet.set(undefined)

    clearModals()
  }
</script>

<Confirm
  {confirm}
  title="Disconnect Wallet"
  message="Are you sure you want to disconnect your bitcoin wallet?" />
