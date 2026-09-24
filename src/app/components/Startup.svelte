<script lang="ts">
  import {onMount} from "svelte"
  import {ms} from "@welshman/lib"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {PLATFORM_NAME} from "@app/env"
  import {resetSession} from "@app/session"

  type Props = {
    error?: unknown
  }

  const {error}: Props = $props()

  let stalled = $state(false)
  let loading = $state(false)

  const logout = async () => {
    loading = true

    await resetSession()
  }

  if (error) {
    console.error(error)
  }

  onMount(() => {
    const timeout = setTimeout(() => (stalled = true), ms(10))

    return () => clearTimeout(timeout)
  })
</script>

{#if error || stalled}
  <div class="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
    <p class="text-xl font-bold">
      {#if error}
        {PLATFORM_NAME} couldn't start
      {:else}
        {PLATFORM_NAME} is still starting
      {/if}
    </p>
    <p class="max-w-sm">
      This usually means your signer isn't responding. Logging out clears this device and takes you
      back to the login screen.
    </p>
    <Button class="button button-primary" onclick={logout} disabled={loading}>
      <Spinner {loading} reserveSpace>Log out</Spinner>
    </Button>
  </div>
{/if}
