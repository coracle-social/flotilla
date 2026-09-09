<script lang="ts">
  import type {Snippet} from "svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import Landing from "@app/components/Landing.svelte"
  import Toast from "@app/components/Toast.svelte"
  import CallBanner from "@app/components/CallBanner.svelte"
  import SpeechBanner from "@app/components/SpeechBanner.svelte"
  import PrimaryNav from "@app/components/PrimaryNav.svelte"
  import {app} from "@app/core"
  import {modal} from "@app/modal"

  type Props = {
    children: Snippet
  }

  const {children}: Props = $props()
</script>

<div class="flex h-screen flex-col overflow-hidden">
  <div class="flex min-h-0 flex-1 overflow-hidden">
    {#if $app.user?.pubkey}
      <PrimaryNav>
        {@render children?.()}
      </PrimaryNav>
    {:else if !$modal}
      <Dialog noEscape children={{component: Landing, props: {}}} />
    {/if}
  </div>
  <CallBanner />
  <SpeechBanner />
</div>
<Toast />
