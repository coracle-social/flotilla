<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import Link from "@app/components/Link.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import {PLATFORM_ABOUT, PLATFORM_TERMS, PLATFORM_PRIVACY, PLATFORM_NAME} from "@app/core/env"
  import {pushModal} from "@app/navigation/dialogs"

  const logIn = () => pushModal(LogIn)
</script>

<HomeSection title="Welcome to {PLATFORM_NAME}">
  {#snippet action()}
    <Button class="button button-primary" onclick={logIn}>Log in</Button>
  {/snippet}
  <p class="px-4 pb-4 text-xs opacity-75">
    By using <Link external class="link" href={PLATFORM_ABOUT}>{PLATFORM_NAME}</Link>, you consent
    to our
    <Link external class="link" href={PLATFORM_TERMS}>Terms of Service</Link> and
    <Link external class="link" href={PLATFORM_PRIVACY}>Privacy Policy</Link>.
  </p>
</HomeSection>
