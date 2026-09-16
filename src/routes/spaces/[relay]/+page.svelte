<script lang="ts">
  import theme from "tailwindcss/defaultTheme"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import {decodeRelay} from "@app/relays"
  import {goToSpace} from "@app/routes"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const md = parseFloat(theme.screens.md) * 16

  let width = $state(window.innerWidth)

  $effect(() => {
    if (width > md) {
      goToSpace(url, {replaceState: true})
    }
  })
</script>

<svelte:window bind:innerWidth={width} />

{#if width <= md}
  <SecondaryNav visible class="secondary-nav--mobile-space w-auto grow">
    <SpaceMenu {url} mobile />
  </SecondaryNav>
{/if}
