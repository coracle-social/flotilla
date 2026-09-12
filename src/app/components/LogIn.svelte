<script lang="ts">
  import cx from "classnames"
  import {onMount} from "svelte"
  import {Capacitor} from "@capacitor/core"
  import {getNip07, getNip55, Nip55Signer} from "@welshman/signer"
  import {nip07, nip55, toSession} from "@welshman/app"
  import type {Session} from "@welshman/app"
  import Widget from "@assets/icons/widget-4.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Cpu from "@assets/icons/cpu-bolt.svg?dataurl"
  import Compass from "@assets/icons/compass-big.svg?dataurl"
  import Key from "@assets/icons/key.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SignUp from "@app/components/SignUp.svelte"
  import InfoNostr from "@app/components/InfoNostr.svelte"
  import LogInBunker from "@app/components/LogInBunker.svelte"
  import LogInEmail from "@app/components/LogInEmail.svelte"
  import LogInKey from "@app/components/LogInKey.svelte"
  import {pushModal, clearModals} from "@app/modal"
  import {PLATFORM_NAME, POMADE_SIGNERS} from "@app/env"
  import {pushToast} from "@app/toast"
  import {setChecked} from "@app/notifications"
  import {login} from "@app/core"

  let signers: any[] = $state([])
  let loading: string | undefined = $state()

  const hasPomade = POMADE_SIGNERS.length >= 3

  const disabled = $derived(loading ? true : undefined)

  const signUp = () => pushModal(SignUp)

  const onSuccess = async (session: Session) => {
    await login(session)
    setChecked("*")
    clearModals()
  }

  const loginWithNip07 = async () => {
    loading = "nip07"

    try {
      const pubkey = await getNip07()?.getPublicKey()

      if (pubkey) {
        await onSuccess(toSession(nip07, {}))
      } else {
        pushToast({
          theme: "error",
          message: "Something went wrong! Please try again.",
        })
      }
    } finally {
      loading = undefined
    }
  }

  const loginWithNip55 = async (signerApp: any) => {
    loading = "nip55"

    try {
      const signer = new Nip55Signer(signerApp.packageName)
      const pubkey = await signer.getPubkey()

      if (pubkey) {
        await onSuccess(toSession(nip55, {pubkey, signer: signerApp.packageName}))
      } else {
        pushToast({
          theme: "error",
          message: "Something went wrong! Please try again.",
        })
      }
    } finally {
      loading = undefined
    }
  }

  const loginWithEmail = () => pushModal(LogInEmail)

  const loginWithBunker = () => pushModal(LogInBunker)

  const loginWithKey = () => pushModal(LogInKey)

  const hasSigner = $derived(getNip07() || signers.length > 0)

  onMount(async () => {
    if (Capacitor.getPlatform() === "android") {
      signers = await getNip55()
    }
  })
</script>

<Modal data-testid="login">
  <ModalBody>
    <ModalTitle>Log in with Nostr</ModalTitle>
    <p class="m-auto max-w-sm text-center">
      {PLATFORM_NAME} is built using the
      <Button class="link" onclick={() => pushModal(InfoNostr)}>nostr protocol</Button>, which
      allows you to own your social identity.
    </p>
    {#if getNip07()}
      <Button {disabled} onclick={loginWithNip07} class="button button-primary">
        {#if loading === "nip07"}
          <Spinner size="sm" class="mr-3" />
        {:else}
          <Icon icon={Widget} />
        {/if}
        Log in with Extension
      </Button>
    {/if}
    {#each signers as signerApp (signerApp.name)}
      <Button {disabled} class="button button-primary" onclick={() => loginWithNip55(signerApp)}>
        {#if loading === "nip55"}
          <Spinner size="sm" class="mr-3" />
        {:else}
          <img src={signerApp.iconUrl} alt={signerApp.name} width="20" height="20" />
        {/if}
        Log in with {signerApp.name}
      </Button>
    {/each}
    {#if hasPomade && !hasSigner}
      <Button {disabled} onclick={loginWithEmail} class="button button-primary">
        <Icon icon={Letter} />
        Log in with Email
      </Button>
    {/if}
    <Button
      onclick={loginWithBunker}
      {disabled}
      class={cx(`button button-${hasSigner || hasPomade ? "neutral" : "primary"}`)}>
      <Icon icon={Cpu} />
      Log in with Remote Signer
    </Button>
    {#if hasPomade && hasSigner}
      <Button {disabled} onclick={loginWithEmail} class="button button-neutral">
        <Icon icon={Letter} />
        Log in with Email
      </Button>
    {/if}
    {#if !hasSigner}
      <Button {disabled} onclick={loginWithKey} class="button button-neutral">
        <Icon icon={Key} />
        Log in with Key
      </Button>
    {/if}
    {#if !hasSigner || !hasPomade}
      <Link
        external
        {disabled}
        href="https://nostrapps.com#signers"
        class="button {hasSigner || hasPomade ? '' : 'button-neutral'}">
        <Icon icon={Compass} />
        Browse Signer Apps
      </Link>
    {/if}
    <div class="text-sm">
      Need an account?
      <Button class="link" onclick={signUp}>Register instead</Button>
    </div>
  </ModalBody>
</Modal>
