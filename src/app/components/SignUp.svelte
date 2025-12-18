<script lang="ts">
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import InfoNostr from "@app/components/InfoNostr.svelte"
  import SignUpProfile from "@app/components/SignUpProfile.svelte"
  import {pushModal} from "@app/util/modal"
  import {POMADE_SIGNERS, PLATFORM_NAME} from "@app/core/state"

  const hasPomade = POMADE_SIGNERS.length >= 3

  const login = () => pushModal(LogIn)

  const useEmail = () => pushModal(SignUpProfile, {flow: "email"})

  const useNostr = () => pushModal(SignUpProfile, {flow: "nostr"})
</script>

<div class="column gap-4">
  <h1 class="heading">Sign up with Nostr</h1>
  <p class="m-auto max-w-sm text-center">
    {PLATFORM_NAME} is built using the
    <Button class="link" onclick={() => pushModal(InfoNostr)}>nostr protocol</Button>, which gives
    users control over their digital identity using <strong>cryptographic key pairs</strong>.
  </p>
  {#if hasPomade}
    <Button onclick={useEmail} class="btn btn-primary">
      <Icon icon={Letter} />
      Sign up with email
    </Button>
  {/if}
  <Button onclick={useNostr} class="btn {hasPomade ? 'btn-neutral' : 'btn-primary'}">
    <Icon icon={Key} />
    Generate a key
  </Button>
  <div class="text-sm">
    Already have an account?
    <Button class="link" onclick={login}>Log in instead</Button>
  </div>
</div>
