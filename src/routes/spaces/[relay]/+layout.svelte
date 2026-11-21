<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {navigating} from "$app/state"
  import Page from "@lib/components/Page.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import SpaceNotify from "@app/components/SpaceNotify.svelte"
  import {showSpacePrompt, watchSpaceCheckout} from "@app/components/flows/spaces"
  import {deriveSpaceStep, loadSpace} from "@app/tools/spaces"
  import {getModal} from "@app/navigation/dialogs"
  import * as pages from "@app/navigation/pages"
  import type {LayoutProps} from "./$types"

  const {children, params}: LayoutProps = $props()

  const {url} = pages.space.decode(params)

  const step = deriveSpaceStep(url)

  // A modal owns a history entry, so a prompt waits for the page to settle.
  $effect(() => {
    if (!getModal() && !navigating.to) {
      showSpacePrompt(url, $step)
    }
  })

  // Visiting a space identifies to it, and a checkout is watched for as long as the page is open.
  onMount(() => {
    const unload = loadSpace(url)
    const unwatch = watchSpaceCheckout(url)

    return () => {
      unload()
      unwatch()
    }
  })
</script>

{#if $page.url.pathname === pages.space.path({url})}
  {@render children?.()}
{:else}
  <SecondaryNav>
    <SpaceMenu {url} />
  </SecondaryNav>
  <Page>
    <SpaceNotify {url} />
    <!-- SvelteKit builds a new page when the route changes and keeps the one it has when only the
         params change, so this rebuilds it for the second case. The url the page store reports
         arrives a tick after the page is built, so keying on that throws the new page away. -->
    {#key JSON.stringify(params)}
      {@render children?.()}
    {/key}
  </Page>
{/if}
