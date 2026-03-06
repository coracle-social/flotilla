<script lang="ts">
  import {Client} from "@pomade/core"
  import {choice} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Key from "@assets/icons/key.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import {getKey, setKey} from "@lib/implicit"
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
  import SignUpEmailConfirm from "@app/components/SignUpEmailConfirm.svelte"
  import {pushToast, popToast} from "@app/util/toast"
  import {pushModal} from "@app/util/modal"

  type Props = {
    next: () => void
  }

  const {next}: Props = $props()

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
      const toastId = pushToast({
        timeout: 60_000,
        message: "Creating your account, please wait...",
      })

      const secret = getKey<string>("signup.secret")!
      const {clientOptions, ...registerRes} = await Client.register(2, 3, secret)

      if (!registerRes.ok) {
        return pushToast({
          theme: "error",
          message: "Failed to register! Please try again.",
        })
      }

      const client = new Client(clientOptions)
      const setupRes = await client.setupRecovery(email, password)

      if (!setupRes.ok) {
        const message = setupRes.messages.find(m => m.res && !m.res?.ok)?.res?.message || "Please try again."

        return pushToast({
          theme: "error",
          message: `Failed to register! ${message}.`,
        })
      }

      const challengeRes = await Client.requestChallenge(email, [choice(clientOptions.peers)])

      if (!challengeRes.ok) {
        return pushToast({
          theme: "error",
          message: `Failed to request confirmation code! Please try again.`,
        })
      }

      setKey("signup.email", email)
      setKey("signup.clientOptions", clientOptions)

      popToast(toastId)
      pushModal(SignUpEmailConfirm, {next})
    } catch (e) {
      console.error(e)

      pushToast({
        theme: "error",
        message: "Failed to register! Please try again.",
      })
    } finally {
      loading = false
    }
  }

  let email = $state("")
  let password = $state("")
  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Sign up with Email</ModalTitle>
      <ModalSubtitle>Keep your keys safe using multi-signer key sharing</ModalSubtitle>
    </ModalHeader>
    <p>
      Under the hood, nostr uses "cryptographic keypairs" to help you prove that your identity is
      actually you.
    </p>
    <p>
      If you you're not ready to take control of your keys though, that's ok! We'll keep them safe
      until you are.
    </p>
    <FieldInline>
      {#snippet label()}
        <p>Email*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <Icon icon={Letter} />
          <input bind:value={email} />
        </label>
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Password*</p>
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
    <Button class="btn btn-primary" type="submit" disabled={loading || !email || !password}>
      <Spinner {loading}>Continue</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
