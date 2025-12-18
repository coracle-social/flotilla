<script lang="ts">
  import {postJson} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Button from "@lib/components/Button.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import InfoNostr from "@app/components/InfoNostr.svelte"
  import SignUpProfile from "@app/components/SignUpProfile.svelte"
  import {pushModal} from "@app/util/modal"
  import {POMADE_SIGNERS, PLATFORM_NAME} from "@app/core/state"
  import {pushToast} from "@app/util/toast"

  const login = () => pushModal(LogIn)

  const useEmail = () => pushModal(SignUpProfile, {flow: 'email'})

  const useNostr = () => pushModal(SignUpProfile, {flow: 'nostr'})

  let email = $state("")
  let loading = $state(false)
</script>

<div class="column gap-4">
  <h1 class="heading">Sign up with Nostr</h1>
  <p class="m-auto max-w-sm text-center">
    {PLATFORM_NAME} is built using the
    <Button class="link" onclick={() => pushModal(InfoNostr)}>nostr protocol</Button>, which gives
    users control over their digital identity using <strong>cryptographic key pairs</strong>.
  </p>
  {#if POMADE_SIGNERS.length}
    <Button onclick={useEmail} class="btn btn-primary">
      <Icon icon={Letter} />
      Sign up with email
    </Button>
  {/if}
  <Button onclick={useNostr} class="btn {POMADE_SIGNERS.length ? 'btn-neutral' : 'btn-primary'}">
    <Icon icon={Key} />
    Generate a key
  </Button>
  <div class="text-sm">
    Already have an account?
    <Button class="link" onclick={login}>Log in instead</Button>
  </div>
</div>
