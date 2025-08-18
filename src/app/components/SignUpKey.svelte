<script lang="ts">
  import {nsecEncode} from "nostr-tools/nip19"
  import {encrypt} from "nostr-tools/nip49"
  import {hexToBytes} from "@welshman/lib"
  import {makeSecret} from "@welshman/signer"
  import type {Profile} from "@welshman/util"
  import {preventDefault, downloadText} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import SignUpComplete from "@app/components/SignUpComplete.svelte"
  import {pushToast} from "@app/toast"
  import {pushModal} from "@app/modal"

  type Props = {
    profile: Profile
  }

  const {profile}: Props = $props()

  const secret = makeSecret()

  const back = () => history.back()

  const downloadKey = () => {
    if (usePassword) {
      if (password.length < 12) {
        return pushToast({
          theme: "error",
          message: "Your password must be at least 12 characters long.",
        })
      }

      const ncryptsec = encrypt(hexToBytes(secret), password)

      downloadText("Nostr Secret Key.txt", ncryptsec)
    } else {
      const nsec = nsecEncode(hexToBytes(secret))

      downloadText("Nostr Secret Key.txt", nsec)
    }

    didDownload = true
  }

  const next = () => {
    pushModal(SignUpComplete, {profile, secret})
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

<form class="column gap-4" onsubmit={preventDefault(next)}>
  <ModalHeader>
    {#snippet title()}
      <div>Your Keys are Ready!</div>
    {/snippet}
  </ModalHeader>
  <p>
    A cryptographic key pair has two parts: your <strong>public key</strong> identifies your
    account, while your <strong>private key</strong> acts sort of like a master password.
  </p>
  <p>
    Securing your private key is very important, so make sure to take the time to save your key in a
    secure place (like a password manager).
  </p>
  {#if usePassword}
    <Field>
      {#snippet label()}
        Password*
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <Icon icon="key" />
          <input bind:value={password} onchange={onPasswordChange} class="grow" type="password" />
        </label>
      {/snippet}
      {#snippet info()}
        <p>Passwords should be at least 12 characters long. Write this down!</p>
      {/snippet}
    </Field>
  {/if}
  <div class="flex flex-col">
    <Button class="btn {didDownload ? 'btn-neutral' : 'btn-primary'}" onclick={downloadKey}>
      Download my key
      <Icon icon="arrow-down" />
    </Button>
    <Button class="btn btn-link no-underline" onclick={toggleUsePassword}>
      {#if usePassword}
        Nevermind, I want to download the plain version
      {:else}
        I want to download an encrypted version
      {/if}
    </Button>
  </div>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon="alt-arrow-left" />
      Go back
    </Button>
    <Button disabled={!didDownload} class="btn btn-primary" type="submit">
      Continue
      <Icon icon="alt-arrow-right" />
    </Button>
  </ModalFooter>
</form>
