<script lang="ts">
  import cx from "classnames"
  import {nsecEncode} from "nostr-tools/nip19"
  import {encrypt} from "nostr-tools/nip49"
  import {hexToBytes} from "@welshman/lib"
  import {preventDefault, downloadText} from "@lib/html"
  import {errorMessage} from "@lib/util"
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import ArrowDown from "@assets/icons/arrow-down.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProgressBar from "@app/components/ProgressBar.svelte"
  import {pushToast} from "@app/toast"
  import {PLATFORM_NAME} from "@app/env"

  type Props = {
    secret: string
    next: () => unknown
    submitText?: string
    step?: number
    totalSteps?: number
  }

  const {secret, next, submitText = "Continue", step, totalSteps}: Props = $props()

  const back = () => history.back()

  const cleanupCopy = (copy: string) =>
    copy
      .replace(/\n\s*\n\s*/g, "NEWLINE")
      .replace(/\s+/g, " ")
      .replace(/NEWLINE/g, "\n\n")
      .trim()

  const downloadKey = async () => {
    const sharedCopy = `
    Most online services keep track of users by giving them a username and password. This gives the
    service total control over their users, allowing them to ban them at any time, or sell their activity.

    On Nostr, you control your own identity and social data, through the magic of cryptography. The basic
    idea is that you have a public key, which acts as your user ID, and a private key which allows you to
    prove your identity.

    It's very important to keep your private key secret because it grants permanent and complete access to your
    account.
    `

    let instructions: string

    if (usePassword) {
      if (password.length < 12) {
        return pushToast({
          theme: "error",
          message: "Your password must be at least 12 characters long.",
        })
      }

      const ncryptsec = encrypt(hexToBytes(secret), password)
      instructions = `
      This file contains a backup of your Nostr secret key, downloaded from ${PLATFORM_NAME} and encrypted using
      a password you chose when you backed up your key.

      ${sharedCopy}

      Your encrypted private key is:

      ${ncryptsec}

      To use it to log in to other Nostr apps, find a Nostr Signer app (https://nostrapps.com/#signers is a good
      place to look), and import your key.
      `
    } else {
      const nsec = nsecEncode(hexToBytes(secret))
      instructions = `
      This file contains a backup of your Nostr secret key, downloaded from ${PLATFORM_NAME}.

      ${sharedCopy}

      Your private key is:

      ${nsec}

      To use it to log in to other Nostr apps, find a Nostr Signer app (https://nostrapps.com/#signers is a good
      place to look), and import your key.
      `
    }

    try {
      await downloadText("Nostr Secret Key.txt", cleanupCopy(instructions))
      didDownload = true
    } catch (e) {
      // Dismissing the native share sheet rejects with "Share canceled".
      if (!errorMessage(e).toLowerCase().includes("cancel")) {
        console.error(e)
        pushToast({theme: "error", message: "We couldn't save your key. Please try again."})
      }
    }
  }

  const onPasswordChange = () => {
    didDownload = false
  }

  const toggleUsePassword = () => {
    usePassword = !usePassword
    didDownload = false
  }

  let password = $state("")
  let usePassword = $state(false)
  let didDownload = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(next)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Backup your Key</ModalTitle>
    </ModalHeader>
    <p>
      A cryptographic key pair has two parts: your <strong>public key</strong> identifies your
      account, while your <strong>private key</strong> acts sort of like a master password.
    </p>
    <p>
      Securing your private key is very important, so make sure to take the time to save your key in
      a secure place (like a password manager).
    </p>
    {#if usePassword}
      <Field>
        {#snippet label()}
          Password*
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <Icon icon={Key} />
            <input bind:value={password} onchange={onPasswordChange} class="grow" type="password" />
          </label>
        {/snippet}
        {#snippet info()}
          <p>Passwords should be at least 12 characters long. Write this down!</p>
        {/snippet}
      </Field>
    {/if}
    <div class="flex flex-col">
      <Button
        class={cx(`button button-${didDownload ? "neutral" : "primary"}`)}
        onclick={downloadKey}>
        Download my key
        <Icon icon={ArrowDown} />
      </Button>
      <Button class="button button-link no-underline" onclick={toggleUsePassword}>
        {#if usePassword}
          Nevermind, I want to download the plain version
        {:else}
          I want to download an encrypted version
        {/if}
      </Button>
    </div>
  </ModalBody>
  {#if step && totalSteps}
    <ProgressBar current={step} total={totalSteps} />
  {/if}
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" disabled={!didDownload} type="submit">
      {submitText}
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
