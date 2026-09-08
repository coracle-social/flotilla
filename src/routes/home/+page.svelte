<script lang="ts">
  import {onMount} from "svelte"
  import Home from "@assets/icons/home.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import HomeInbox from "@app/components/HomeInbox.svelte"
  import HomeNetwork from "@app/components/HomeNetwork.svelte"
  import HomeHealthChecks from "@app/components/HomeHealthChecks.svelte"
  import HomeHosting from "@app/components/HomeHosting.svelte"
  import {goToSpace} from "@app/routes"
  import {HOSTING_ENABLED} from "@app/hosting"
  import {PLATFORM_RELAYS} from "@app/env"

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
  <PageContent class="flex flex-col gap-4 p-2 sm:p-4 lg:flex-row lg:items-start">
    <div class="flex min-w-0 flex-col gap-4 lg:flex-[2]">
      <HomeInbox />
      <HomeNetwork />
    </div>
    <div class="flex min-w-0 flex-col gap-4 lg:flex-1">
      <HomeHealthChecks />
      {#if HOSTING_ENABLED}
        <HomeHosting />
      {/if}
    </div>
  </PageContent>
</Page>
