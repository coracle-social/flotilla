<script lang="ts">
  import type {Snippet} from "svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import Landing from "@app/components/Landing.svelte"
  import Toast from "@app/components/Toast.svelte"
  import CallBanner from "@app/components/CallBanner.svelte"
  import ReadAloudBanner from "@app/components/ReadAloudBanner.svelte"
  import PrimaryNav from "@app/components/PrimaryNav.svelte"
  import LogInPrompt from "@app/components/LogInPrompt.svelte"
  import {app} from "@app/core/app"
  import {getModal, pushModal} from "@app/navigation/dialogs"
  import {loginRequest} from "@app/navigation/login"

  type Props = {
    children: Snippet
  }

  const {children}: Props = $props()

  const blockingModal = $derived.by(() => {
    const modal = getModal()

    return Boolean(modal && !modal.options.drawer)
  })

  // withLogin can't import the login dialogs, since they render components that call it.
  $effect(() => {
    if ($loginRequest) {
      pushModal(LogInPrompt, $loginRequest)
      loginRequest.set(undefined)
    }
  })
</script>

<div class="flex h-dvh flex-col overflow-hidden" inert={blockingModal}>
  <div class="relative flex min-h-0 flex-1 overflow-hidden">
    {#if $app.user?.pubkey}
      <PrimaryNav>
        {@render children?.()}
      </PrimaryNav>
    {:else if !getModal()}
      <Dialog noEscape children={{component: Landing, props: {}}} />
    {/if}
  </div>
  <CallBanner />
  <ReadAloudBanner />
  <!-- The mobile nav is fixed over the page, so its footprint is reserved once here. -->
  <div class="h-[calc(var(--saib)+var(--mobile-nav-height))] shrink-0"></div>
</div>
<Toast />
