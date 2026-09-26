<script lang="ts">
  import {Client} from "@pomade/core"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import LogInOTPConfirm from "@app/components/LogInOTPConfirm.svelte"
  import {POMADE_NETWORK_ERROR_MESSAGE} from "@app/pomade"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    email?: string
  }

  let {email = $bindable("")}: Props = $props()

  const back = () => history.back()

  const onSubmit = async () => {
    loading = true

    try {
      const {ok, peersByPrefix} = await Client.requestChallenge(email)

      if (ok) {
        pushModal(LogInOTPConfirm, {email, peersByPrefix})
      } else {
        console.error("Pomade challenge request failed during OTP login")

        pushToast({
          theme: "error",
          message: POMADE_NETWORK_ERROR_MESSAGE,
        })
      }
    } catch (error) {
      console.error(error)

      pushToast({
        theme: "error",
        message: POMADE_NETWORK_ERROR_MESSAGE,
      })
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Log In</ModalTitle>
      <ModalSubtitle>Log in using a one-time login code</ModalSubtitle>
    </ModalHeader>
    <FieldInline>
      {#snippet label()}
        <p>Email*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-group flex w-full items-center gap-2">
          <Icon icon={Letter} />
          <input type="email" bind:value={email} />
        </label>
      {/snippet}
    </FieldInline>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading || !email}>
      <Spinner {loading}>Log in</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
