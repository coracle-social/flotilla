<script lang="ts">
  import {page} from "$app/stores"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import Link from "@app/components/Link.svelte"
  import LogInOptions from "@app/components/LogInOptions.svelte"
  import RelayLabel from "@app/components/RelayLabel.svelte"
  import {parseInviteLink} from "@app/areas/spaces/invites"
  import {
    PLATFORM_ABOUT,
    PLATFORM_TERMS,
    PLATFORM_PRIVACY,
    PLATFORM_NAME,
    PLATFORM_DESCRIPTION,
  } from "@app/core/env"

  const invite = $derived(
    $page.url.pathname === "/join" ? parseInviteLink($page.url.href) : undefined,
  )
</script>

<Modal>
  <ModalBody>
    <div class="py-2">
      {#if invite}
        <ModalTitle>Welcome to</ModalTitle>
        <p class="m-auto max-w-sm text-center text-primary"><RelayLabel url={invite.url} /></p>
      {:else}
        <ModalTitle>Welcome to<br />{PLATFORM_NAME}!</ModalTitle>
        <p class="m-auto max-w-sm text-center">{PLATFORM_DESCRIPTION}</p>
      {/if}
    </div>
    <LogInOptions />
    <p class="text-center text-xs opacity-75">
      By using <Link external class="link" href={PLATFORM_ABOUT}>{PLATFORM_NAME}</Link>, you consent
      to our
      <Link external class="link" href={PLATFORM_TERMS}>Terms of Service</Link> and
      <Link external class="link" href={PLATFORM_PRIVACY}>Privacy Policy</Link>.
    </p>
  </ModalBody>
</Modal>
