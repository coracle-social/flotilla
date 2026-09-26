<script lang="ts">
  import {onMount} from "svelte"
  import Home from "@assets/icons/home.svg?dataurl"
  import Compass from "@assets/icons/compass.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Page from "@lib/components/Page.svelte"
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
  <PageContent bind:element class="@container p-0 md:p-4">
    <div class="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-3">
      <div class="flex items-center justify-between gap-4 px-4 py-3 md:px-2 md:pt-0">
        <h1 class="flex items-center gap-2 text-xl font-bold">
          <Icon icon={Home} size={6} />
          Home
        </h1>
        <Link href="/spaces" class="button button-neutral button-sm">
          <Icon icon={Compass} size={4} />
          Browse spaces
        </Link>
      </div>
      <div class="flex min-w-0 flex-col gap-3 @2xl:flex-row @2xl:items-start">
        <!-- Both columns are `contents` on a narrow page, which puts every section in one flow and lets
             the rail sit between the day's activity and the feed that would otherwise bury it. -->
        <div class="contents @2xl:flex @2xl:min-w-0 @2xl:flex-1 @2xl:flex-col @2xl:gap-3">
          <HomeInbox />
          <HomeActivity />
          <HomeNetwork class="order-last @2xl:order-none" />
        </div>
        <div class="contents @2xl:flex @2xl:w-80 @2xl:shrink-0 @2xl:flex-col @2xl:gap-3">
          <HomeHealthChecks />
          {#if HOSTING_ENABLED}
            <HomeHosting class="@max-2xl:hidden" />
          {/if}
        </div>
      </div>
    </div>
  </PageContent>
  <ScrollToTop {element} />
</Page>
