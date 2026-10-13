<script lang="ts">
  import {onDestroy} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import {popModal} from "@app/ui/modal"
  import {goToEvent} from "@app/ui/routes"
  import {loadQuote} from "@app/features/quotes"
  import type {QuotePointer} from "@app/features/quotes"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    pointer: QuotePointer
    event: TrustedEvent
    url?: string
  }

  const {pointer, event, url}: Props = $props()

  let waiting = true

  onDestroy(() => {
    waiting = false
  })

  loadQuote(pointer, event, url).then(quoted => {
    if (waiting) {
      popModal()

      if (quoted) {
        goToEvent(quoted, {replaceState: true})
      } else {
        pushToast({theme: "error", message: "Failed to load that event."})
      }
    }
  })
</script>

<Modal label="Quote">
  <ModalBody>
    <div class="flex justify-center py-20">
      <Spinner loading>Loading event...</Spinner>
    </div>
  </ModalBody>
</Modal>
