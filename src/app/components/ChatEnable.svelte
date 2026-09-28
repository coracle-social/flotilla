<script lang="ts">
  import {preventDefault} from "@lib/html"
  import {RelayLists} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {deriveUserItem, messagingRelayLists, relayLists} from "@app/core"
  import {DEFAULT_RELAYS, DEFAULT_MESSAGING_RELAYS} from "@app/env"
  import {pushToast} from "@app/toast"

  type Props = {
    next: () => void
  }

  const {next}: Props = $props()

  const userRelayList = deriveUserItem(RelayLists)

  const back = () => history.back()

  const enable = async () => {
    loading = true

    try {
      const relayUrls = $userRelayList?.urls() ?? []

      if (relayUrls.length === 0) {
        const command = await $relayLists.update(writer =>
          writer.setReadUrls(DEFAULT_RELAYS).setWriteUrls(DEFAULT_RELAYS),
        )

        const error = (await command.publish().settled()).getError()

        if (error) {
          pushToast({theme: "error", message: error})
          return
        }
      }

      const command = await $messagingRelayLists.setUrls(DEFAULT_MESSAGING_RELAYS)
      const error = (await command.publish().settled()).getError()

      if (error) {
        pushToast({theme: "error", message: error})
        return
      }

      await next()
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to enable messaging."})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(enable)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Enable direct messaging?</ModalTitle>
    </ModalHeader>
    <p>Direct messaging isn't currently enabled. Would you like to turn it on?</p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Enable direct messaging</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
