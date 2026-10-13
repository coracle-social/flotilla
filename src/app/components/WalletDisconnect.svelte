<script lang="ts">
  import Confirm from "@lib/components/Confirm.svelte"
  import {wallet} from "@app/features/lightning"
  import {clearModals} from "@app/ui/modal"

  const confirm = async () => {
    wallet.set(undefined)

    clearModals()
  }
</script>

<Confirm
  {confirm}
  title="Disconnect Wallet"
  message="Are you sure you want to disconnect your bitcoin wallet?" />
