<script lang="ts">
  import Home from "@assets/icons/home.svg?dataurl"
  import Compass from "@assets/icons/compass.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import ScrollToTop from "@lib/components/ScrollToTop.svelte"
  import HomeFeed from "@app/components/HomeFeed.svelte"
  import HomeHealthChecks from "@app/components/HomeHealthChecks.svelte"
  import HomeHosting from "@app/components/HomeHosting.svelte"
  import HomeSpaces from "@app/components/HomeSpaces.svelte"
  import PostCreateFab from "@app/components/PostCreateFab.svelte"
  import {HOSTING_ENABLED} from "@app/features/hosting"
  import {PLATFORM_RELAYS} from "@app/core/env"

  let element: Element | undefined = $state()
</script>

<Page>
  <PageContent bind:element class="@container p-0 md:p-4">
    <div class="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-3">
      <div class="hidden items-center justify-between gap-4 md:flex md:px-2 md:pt-0">
        <h1 class="flex items-center gap-2 text-xl font-bold">
          <Icon icon={Home} size={6} />
          Home
        </h1>
        {#if PLATFORM_RELAYS.length === 0}
          <Link href="/spaces" class="button button-neutral button-sm">
            <Icon icon={Compass} size={4} />
            Browse spaces
          </Link>
        {/if}
      </div>
      <div class="flex min-w-0 flex-col gap-0 @3xl:flex-row @3xl:items-start md:gap-3">
        <HomeFeed class="@3xl:min-w-0 @3xl:flex-1" />
        <div class="contents @3xl:flex @3xl:w-80 @3xl:shrink-0 @3xl:flex-col @3xl:gap-3">
          <HomeHealthChecks class="@max-3xl:hidden" />
          {#if PLATFORM_RELAYS.length > 0}
            <HomeSpaces class="@max-3xl:hidden" />
          {:else if HOSTING_ENABLED}
            <HomeHosting class="@max-3xl:hidden" />
          {/if}
        </div>
      </div>
    </div>
  </PageContent>
  <!-- The FAB holds this corner on a phone, so the scroll button goes above it. -->
  <ScrollToTop {element} class="max-md:bottom-20" />
</Page>

<PostCreateFab />
