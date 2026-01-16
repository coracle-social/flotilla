<script lang="ts">
  import {onMount} from "svelte"
  import {Capacitor} from "@capacitor/core"
  import {getNip07, getNip55, Nip55Signer} from "@welshman/signer"
  import {addSession, type Session, makeNip07Session, makeNip55Session} from "@welshman/app"
  import Widget from "@assets/icons/widget-2.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Cpu from "@assets/icons/cpu-bolt.svg?dataurl"
  import Compass from "@assets/icons/compass-big.svg?dataurl"
  import Key from "@assets/icons/key.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import SignUp from "@app/components/SignUp.svelte"
  import InfoNostr from "@app/components/InfoNostr.svelte"
  import LogInBunker from "@app/components/LogInBunker.svelte"
  import LogInEmail from "@app/components/LogInEmail.svelte"
  import LogInKey from "@app/components/LogInKey.svelte"
  import {pushModal, clearModals} from "@app/util/modal"
  import {PLATFORM_NAME, POMADE_SIGNERS} from "@app/core/state"
  import {pushToast} from "@app/util/toast"
  import {setChecked} from "@app/util/notifications"

  let signers: any[] = $state([])
  let loading: string | undefined = $state()

  const hasPomade = POMADE_SIGNERS.length >= 3

  const disabled = $derived(loading ? true : undefined)

  const signUp = () => pushModal(SignUp)

  const onSuccess = async (session: Session) => {
    addSession(session)
    pushToast({message: "Successfully logged in!"})
    setChecked("*")
    clearModals()
  }

  const loginWithNip07 = async () => {
    loading = "nip07"

    try {
      const pubkey = await getNip07()?.getPublicKey()

      if (pubkey) {
        await onSuccess(makeNip07Session(pubkey))
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

  const loginWithNip55 = async (app: any) => {
    loading = "nip55"

    try {
      const signer = new Nip55Signer(app.packageName)
      const pubkey = await signer.getPubkey()

      if (pubkey) {
        await onSuccess(makeNip55Session(pubkey, app.packageName))
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
    if (Capacitor.isNativePlatform()) {
      signers = await getNip55()
    }
  })
</script>

<div class="column gap-4">
  <h1 class="heading">Log in with Nostr</h1>
  <p class="m-auto max-w-sm text-center">
    {PLATFORM_NAME} is built using the
    <Button class="link" onclick={() => pushModal(InfoNostr)}>nostr protocol</Button>, which allows
    you to own your social identity.
  </p>
  {#if getNip07()}
    <Button {disabled} onclick={loginWithNip07} class="btn btn-primary">
      {#if loading === "nip07"}
        <span class="loading loading-spinner mr-3"></span>
      {:else}
        <Icon icon={Widget} />
      {/if}
      Log in with Extension
    </Button>
  {/if}
  {#each signers as app}
    <Button {disabled} class="btn btn-primary" onclick={() => loginWithNip55(app)}>
      {#if loading === "nip55"}
        <span class="loading loading-spinner mr-3"></span>
      {:else}
        <img src={app.iconUrl} alt={app.name} width="20" height="20" />
      {/if}
      Log in with {app.name}
    </Button>
  {/each}
  {#if hasPomade && !hasSigner}
    <Button {disabled} onclick={loginWithEmail} class="btn btn-primary">
      <Icon icon={Letter} />
      Log in with Email
    </Button>
  {/if}
  <Button
    onclick={loginWithBunker}
    {disabled}
    class="btn {hasSigner || hasPomade ? 'btn-neutral' : 'btn-primary'}">
    <Icon icon={Cpu} />
    Log in with Remote Signer
  </Button>
  {#if hasPomade && hasSigner}
    <Button {disabled} onclick={loginWithEmail} class="btn">
      <Icon icon={Letter} />
      Log in with Email
    </Button>
  {/if}
  {#if !hasSigner}
    <Button {disabled} onclick={loginWithKey} class="btn btn-neutral">
      <Icon icon={Key} />
      Log in with Key
    </Button>
  {/if}
  {#if !hasSigner || !hasPomade}
    <Link
      external
      {disabled}
      href="https://nostrapps.com#signers"
      class="btn {hasSigner || hasPomade ? '' : 'btn-neutral'}">
      <Icon icon={Compass} />
      Browse Signer Apps
    </Link>
  {/if}
  <div class="text-sm">
    Need an account?
    <Button class="link" onclick={signUp}>Register instead</Button>
  </div>
</div>
