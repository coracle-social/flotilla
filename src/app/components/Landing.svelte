<script lang="ts">
  import {page} from "$app/stores"
  import {displayRelayUrl} from "@welshman/util"
  import Login from "@assets/icons/login-3.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import CardButton from "@lib/components/CardButton.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import SignUp from "@app/components/SignUp.svelte"
  import {parseInviteLink} from "@app/access"
  import {
    PLATFORM_ABOUT,
    PLATFORM_TERMS,
    PLATFORM_PRIVACY,
    PLATFORM_NAME,
    PLATFORM_DESCRIPTION,
  } from "@app/env"
  import {pushModal} from "@app/modal"

  const invite = $derived(
    $page.url.pathname === "/join" ? parseInviteLink($page.url.href) : undefined,
  )

  const logIn = () => pushModal(LogIn)

  const signUp = () => pushModal(SignUp)
</script>

<Modal>
  <ModalBody>
    <div class="py-2">
      {#if invite}
        <ModalTitle>Welcome to</ModalTitle>
        <p class="m-auto max-w-sm text-center text-primary">{displayRelayUrl(invite.url)}</p>
      {:else}
        <ModalTitle>Welcome to<br />{PLATFORM_NAME}!</ModalTitle>
        <p class="m-auto max-w-sm text-center">{PLATFORM_DESCRIPTION}</p>
      {/if}
    </div>
    <Button aria-label="Log in" onclick={logIn}>
      <CardButton primary>
        {#snippet icon()}
          <div><Icon icon={Login} size={7} /></div>
        {/snippet}
        {#snippet title()}
          <div>Log in</div>
        {/snippet}
        {#snippet info()}
          <div>If you've been here before, you know the drill.</div>
        {/snippet}
      </CardButton>
    </Button>
    <Button onclick={signUp}>
      <CardButton>
        {#snippet icon()}
          <div><Icon icon={AddCircle} size={7} /></div>
        {/snippet}
        {#snippet title()}
          <div>Create an account</div>
        {/snippet}
        {#snippet info()}
          <div>Just a few questions and you'll be on your way.</div>
        {/snippet}
      </CardButton>
    </Button>
    <p class="text-center text-xs opacity-75">
      By using <Link external class="link" href={PLATFORM_ABOUT}>{PLATFORM_NAME}</Link>, you consent
      to our
      <Link external class="link" href={PLATFORM_TERMS}>Terms of Service</Link> and
      <Link external class="link" href={PLATFORM_PRIVACY}>Privacy Policy</Link>.
    </p>
  </ModalBody>
</Modal>
