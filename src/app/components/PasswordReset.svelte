<script lang="ts">
  import {Client} from "@pomade/core"
  import type {SessionPomade} from "@welshman/app"
  import {session} from "@welshman/app"
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
  import StringMultiInput from "@lib/components/StringMultiInput.svelte"
  import PasswordResetConfirm from "@app/components/PasswordResetConfirm.svelte"
  import {pushToast} from "@app/util/toast"
  import {pushModal} from "@app/util/modal"
  import {getPomadeClient} from "@app/util/pomade"

  type Props = {
    peersByPrefix: Map<string, string>
  }

  const {peersByPrefix}: Props = $props()

  const {email} = $session as SessionPomade

  const confirmRecovery = async () => {
    const request = await Client.recoverWithChallenge(email, peersByPrefix, otps)

    if (!request.ok) {
      console.log(request.messages)

      return pushToast({
        theme: "error",
        message: `Failed to validate email ownership: ${request.messages[0]?.res?.message.toLowerCase()}`,
      })
    }

    const client = await getPomadeClient()

    if (!client) {
      throw new Error("Unable to get client during password reset flow")
    }

    const result = await Client.selectRecovery(
      request.clientSecret,
      await client.getPubkey(),
      client.peers,
    )

    if (!result.ok) {
      console.log(result.messages)

      return pushToast({
        theme: "error",
        message: `Failed to validate email ownership: ${result.messages[0]?.res?.message.toLowerCase()}`,
      })
    }

    pushModal(PasswordResetConfirm, {userSecret: result.userSecret})
  }

  const submit = async () => {
    loading = true

    try {
      await confirmRecovery()
    } finally {
      loading = false
    }
  }

  const back = () => history.back()

  let loading = $state(false)
  let otps = $state<string[]>([])
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Update your Password</ModalTitle>
      <ModalSubtitle>Confirm your Email</ModalSubtitle>
    </ModalHeader>
    <p>Let's start by confirming your email.</p>
    <p>
      For security reasons, you may receive three or more emails with confirmation codes in them.
      Please paste <strong>all</strong> confirmation codes into the text box below, on separate lines.
    </p>
    <StringMultiInput bind:value={otps} placeholder="Enter your confirmation codes..." />
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading || otps.length < 2}>
      <Spinner {loading}>Continue</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
