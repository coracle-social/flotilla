<script lang="ts">
  import {Client} from "@pomade/core"
  import {session} from "@welshman/app"
  import type {SessionPomade} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Key from "@assets/icons/key.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {loginWithPomade, deleteCurrentPomadeSession} from "@app/util/pomade"
  import {clearModals} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  type Props = {
    userSecret: string
  }

  const {userSecret}: Props = $props()

  const {email} = $session as SessionPomade

  const back = () => history.back()

  const onSubmit = async () => {
    if (password.trim().length < 12) {
      return pushToast({
        theme: "error",
        message: "Password must be at least 12 characters long.",
      })
    }

    loading = true

    try {
      pushToast({
        timeout: 60_000,
        message: "Registering your new password, please wait...",
      })

      const {clientOptions, ...registerRes} = await Client.register(2, 3, userSecret)

      if (!registerRes.ok) {
        return pushToast({
          theme: "error",
          message: "Failed to register your new password! Please try again.",
        })
      }

      const setupRes = await new Client(clientOptions).setupRecovery(email, password)

      if (!setupRes.ok) {
        const message = setupRes.messages[0]?.res?.message || "Please try again."

        return pushToast({
          theme: "error",
          message: `Failed to register your new password! ${message}.`,
        })
      }

      await deleteCurrentPomadeSession()

      pushToast({message: "Your password has been updated!"})
      loginWithPomade(clientOptions, email)
      clearModals()
    } catch (e) {
      console.error(e)

      pushToast({
        theme: "error",
        message: "Failed to register your new password! Please try again.",
      })
    } finally {
      loading = false
    }
  }

  let password = $state("")
  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Update your Password</ModalTitle>
      <ModalSubtitle>Please provide your new password.</ModalSubtitle>
    </ModalHeader>
    <FieldInline>
      {#snippet label()}
        <p>New Password*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <Icon icon={Key} />
          <input type="password" bind:value={password} />
        </label>
      {/snippet}
    </FieldInline>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="btn btn-primary" type="submit" disabled={loading || !password}>
      <Spinner {loading}>Continue</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
