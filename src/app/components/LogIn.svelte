<script lang="ts">
  import cx from "classnames"
  import {onMount} from "svelte"
  import {Capacitor} from "@capacitor/core"
  import {getNip07, getNip55, Nip55Signer} from "@welshman/signer"
  import type {Nip55AppInfo} from "@welshman/signer"
  import {nip07, nip55, toSession} from "@welshman/app"
  import type {Session} from "@welshman/app"
  import Widget from "@assets/icons/widget-4.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Cpu from "@assets/icons/cpu-bolt.svg?dataurl"
  import Key from "@assets/icons/key.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import LogInMenu from "@app/components/LogInMenu.svelte"
  import InfoNostr from "@app/components/InfoNostr.svelte"
  import LogInBunker from "@app/components/LogInBunker.svelte"
  import LogInEmail from "@app/components/LogInEmail.svelte"
  import LogInKey from "@app/components/LogInKey.svelte"
  import {clearModals, pushModal} from "@app/navigation/dialogs"
  import {PLATFORM_NAME, POMADE_SIGNERS, HIDE_NOSTR} from "@app/core/env"
  import {pushToast} from "@app/navigation/toast"
  import {login} from "@app/core/session"

  let signers: Nip55AppInfo[] = $state([])
  let loading: string | undefined = $state()

  const hasPomade = POMADE_SIGNERS.length >= 3

  const disabled = $derived(loading ? true : undefined)

  const back = () => history.back()

  const showInfoNostr = () => pushModal(InfoNostr)

  const onSuccess = async (session: Session) => {
    await login(session)
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
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Something went wrong! Please try again."})
    } finally {
      loading = undefined
    }
  }

  const loginWithNip55 = (signerApp: Nip55AppInfo) => async () => {
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
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Something went wrong! Please try again."})
    } finally {
      loading = undefined
    }
  }

  const loginWithEmail = () => pushModal(LogInEmail)

  const loginWithBunker = () => pushModal(LogInBunker)

  const loginWithKey = () => pushModal(LogInKey)

  const hasSigner = $derived(getNip07() || signers.length > 0)

  // The first method that applies gets the button, and the rest go in its menu.
  const menu = $derived({
    signers: getNip07() ? signers : signers.slice(1),
    loginWithNip55,
    loginWithBunker: !HIDE_NOSTR && (hasSigner || hasPomade) ? loginWithBunker : undefined,
    loginWithEmail: hasSigner && hasPomade ? loginWithEmail : undefined,
    loginWithKey: !hasSigner && (hasPomade || !HIDE_NOSTR) ? loginWithKey : undefined,
  })

  const hasMenu = $derived(
    Boolean(
      menu.signers.length > 0 || menu.loginWithBunker || menu.loginWithEmail || menu.loginWithKey,
    ),
  )

  // A lone button is rounded on both sides, and one joined to its menu only on the left.
  const primaryClass = $derived(
    cx("button button-primary grow", {"join-item rounded-l-2xl": hasMenu}),
  )

  onMount(async () => {
    if (Capacitor.getPlatform() === "android") {
      signers = await getNip55()
    }
  })
</script>

<Modal data-testid="login">
  <ModalBody>
    {#if HIDE_NOSTR}
      <ModalTitle>Log in</ModalTitle>
    {:else}
      <ModalTitle>Log in with Nostr</ModalTitle>
      <p class="m-auto max-w-sm text-center">
        {PLATFORM_NAME} is built using the
        <Button class="link" onclick={showInfoNostr}>nostr protocol</Button>, which allows you to
        own your social identity.
      </p>
    {/if}
    <div class="join">
      {#if getNip07()}
        <Button {disabled} onclick={loginWithNip07} class={primaryClass}>
          {#if loading === "nip07"}
            <Spinner size="sm" class="mr-3" />
          {:else}
            <Icon icon={Widget} />
          {/if}
          Log in with Extension
        </Button>
      {:else if signers.length > 0}
        <Button {disabled} onclick={loginWithNip55(signers[0])} class={primaryClass}>
          {#if loading === "nip55"}
            <Spinner size="sm" class="mr-3" />
          {:else}
            <img src={signers[0].iconUrl} alt={signers[0].name} width="20" height="20" />
          {/if}
          Log in with {signers[0].name}
        </Button>
      {:else if hasPomade}
        <Button {disabled} onclick={loginWithEmail} class={primaryClass}>
          <Icon icon={Letter} />
          Log in with Email
        </Button>
      {:else if !HIDE_NOSTR}
        <Button {disabled} onclick={loginWithBunker} class={primaryClass}>
          <Icon icon={Cpu} />
          Log in with Remote Signer
        </Button>
      {:else}
        <Button {disabled} onclick={loginWithKey} class={primaryClass}>
          <Icon icon={Key} />
          Log in with Key
        </Button>
      {/if}
      {#if hasMenu}
        <MenuButton
          {disabled}
          aria-label="More ways to log in"
          component={LogInMenu}
          componentProps={menu}
          class="button button-primary join-item rounded-r-2xl">
          <Icon icon={AltArrowDown} size={4} />
        </MenuButton>
      {/if}
    </div>
    <Button {disabled} onclick={back} class="button button-ghost">
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalBody>
</Modal>
