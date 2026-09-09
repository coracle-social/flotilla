<script lang="ts">
  import {onMount} from "svelte"
  import Home from "@assets/icons/home.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import ScrollToTop from "@lib/components/ScrollToTop.svelte"
  import HomeInbox from "@app/components/HomeInbox.svelte"
  import HomeActivity from "@app/components/HomeActivity.svelte"
  import HomeNetwork from "@app/components/HomeNetwork.svelte"
  import HomeHealthChecks from "@app/components/HomeHealthChecks.svelte"
  import HomeHosting from "@app/components/HomeHosting.svelte"
  import {goToSpace} from "@app/routes"
  import {HOSTING_ENABLED} from "@app/hosting"
  import {PLATFORM_RELAYS} from "@app/env"

  let element: Element | undefined = $state()

  // A single-space build has no dashboard to show - everything on it is scoped to the one space.
  onMount(() => {
    if (PLATFORM_RELAYS.length > 0) {
      goToSpace(PLATFORM_RELAYS[0], {replaceState: true})
    }
  })
</script>

<Page>
  <PageBar>
    <div class="flex items-center gap-2">
      <Icon icon={Home} size={6} />
      <strong>Home</strong>
    </div>
  </PageBar>
  <PageContent noPad bind:element class="flex flex-col bg-surface">
    <div class="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-stretch">
      <!-- The columns are `contents` below lg, which puts every section in one flow and lets the
           rail's health checks sit between the inbox and the rest of the main column. -->
      <div class="contents lg:flex lg:min-w-0 lg:flex-[2] lg:flex-col lg:border-r lg:border-line">
        <HomeInbox />
        <HomeActivity class="order-last" />
        <HomeNetwork class="order-last border-b-0" />
      </div>
      <div class="contents lg:flex lg:w-96 lg:min-w-0 lg:shrink-0 lg:flex-col">
        <HomeHealthChecks />
        {#if HOSTING_ENABLED}
          <HomeHosting class="border-b-0 max-lg:hidden" />
        {/if}
      </div>
    </div>
  </PageContent>
  <ScrollToTop {element} />
</Page>
