<script lang="ts">
  import {Client} from "@pomade/core"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {pushModal} from "@app/ui/modal"
  import {session} from "@app/core/session"
  import {requirePomadeSession} from "@app/core/pomade"
  import KeyRecoveryConfirm from "@app/components/KeyRecoveryConfirm.svelte"
  import {pushToast} from "@app/ui/toast"

  const {
    email,
    clientOptions: {peers},
  } = requirePomadeSession($session).data

  const requestRecovery = async () => {
    const {peersByPrefix} = await Client.requestChallenge(email, peers)

    pushModal(KeyRecoveryConfirm, {peersByPrefix})
  }

  const submit = async () => {
    loading = true

    try {
      await requestRecovery()
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to request key recovery."})
    } finally {
      loading = false
    }
  }

  const back = () => history.back()

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Recover your Key</ModalTitle>
      <ModalSubtitle>Take control over your cryptographic identity</ModalSubtitle>
    </ModalHeader>
    <p>
      When you signed up, your Nostr secret key was split into multiple pieces and stored on
      separate third-party servers to keep it safe.
    </p>
    <p>
      If you're ready to take control of your cryptographic identity, click below. We'll confirm
      your email by sending you some recovery codes.
    </p>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Request recovery</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
