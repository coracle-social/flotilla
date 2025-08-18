<script lang="ts">
  import {dissoc} from "@welshman/lib"
  import {pubkey, updateSession} from "@welshman/app"
  import Confirm from "@lib/components/Confirm.svelte"
  import {clearModals} from "@app/modal"

  const confirm = async () => {
    updateSession($pubkey!, dissoc("wallet"))

    clearModals()
  }
</script>

<Confirm
  {confirm}
  title="Disconnect Wallet"
  message="Are you sure you want to disconnect your bitcoin wallet?" />
