<script lang="ts">
  import CloudCheck from "@assets/icons/cloud-check.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import ArrowRight from "@assets/icons/arrow-right.svg?dataurl"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageHeader from "@lib/components/PageHeader.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import RelayCreate from "@app/components/hosting/RelayCreate.svelte"
  import {PLATFORM_LOGO, PLATFORM_NAME, PLATFORM_URL} from "@app/env"
  import {HOSTING_ENABLED} from "@app/hosting"
  import {pushModal} from "@app/modal"

  const openCreate = () => pushModal(RelayCreate, {}, {size: "large"})
</script>

<Page>
  <PageContent class="flex flex-col items-center gap-2 p-2 sm:gap-4 sm:p-4">
    <PageHeader>
      {#snippet title()}
        <div>Choose your Hosting Plan</div>
      {/snippet}
      {#snippet info()}
        <p>
          Select how you want to deploy and manage your new Space. You can always migrate later.
        </p>
      {/snippet}
    </PageHeader>
    <div class="flex w-full max-w-lg flex-col gap-4 lg:max-w-4xl">
      <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div class="card flex flex-col gap-5 border" style="border-color: var(--primary)">
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between">
              <img alt="{PLATFORM_NAME} Logo" src={PLATFORM_LOGO} class="h-10 w-10" />
              <span class="badge badge-primary">Recommended</span>
            </div>
            <div class="flex flex-col gap-1">
              <h3 class="text-lg font-bold">
                {PLATFORM_NAME} Hosting
              </h3>
              <div class="text-xs font-semibold tracking-wider opacity-60">FULLY MANAGED</div>
            </div>
            <p class="text-sm opacity-70">
              The premium experience. We handle the infrastructure, security updates, and scaling so
              you can focus on your community.
            </p>
          </div>
          <ul class="flex flex-col gap-2 text-sm">
            <li class="flex items-center gap-2">
              <Icon icon={CheckCircle} class="text-primary" />
              One-click deployment
            </li>
            <li class="flex items-center gap-2">
              <Icon icon={CheckCircle} class="text-primary" />
              Automated backups & scaling
            </li>
            <li class="flex items-center gap-2">
              <Icon icon={CheckCircle} class="text-primary" />
              Priority support
            </li>
          </ul>
          {#if HOSTING_ENABLED}
            <Button class="button button-primary mt-auto" onclick={openCreate}>
              Start for free
              <Icon icon={ArrowRight} />
            </Button>
          {:else}
            <Link
              external
              class="button button-primary mt-auto"
              href="{PLATFORM_URL}/spaces/create">
              Start for free
              <Icon icon={ArrowRight} />
            </Link>
          {/if}
        </div>
        <div class="card flex flex-col gap-5">
          <div class="flex flex-col gap-3">
            <div class="flex h-10 w-10 items-center justify-center text-primary">
              <Icon icon={CloudCheck} size={10} />
            </div>
            <div class="flex flex-col gap-1">
              <h3 class="text-lg font-bold">Community</h3>
              <div class="text-xs font-semibold tracking-wider opacity-60">SELF-HOSTED</div>
            </div>
            <p class="text-sm opacity-70">
              For technical users who want full control. Deploy on your own infrastructure and
              manage your own updates and scaling.
            </p>
          </div>
          <ul class="flex flex-col gap-2 text-sm">
            <li class="flex items-center gap-2">
              <Icon icon={CheckCircle} class="opacity-60" />
              Open source core
            </li>
            <li class="flex items-center gap-2">
              <Icon icon={CheckCircle} class="opacity-60" />
              Community support
            </li>
            <li class="flex items-center gap-2">
              <Icon icon={CheckCircle} class="opacity-60" />
              Bring your own infra
            </li>
          </ul>
          <Link
            external
            class="button button-neutral mt-auto"
            href="https://gitea.coracle.social/coracle/zooid">
            Get started
            <Icon icon={ArrowRight} />
          </Link>
        </div>
      </div>
      <div class="flex flex-col items-center justify-center gap-2 py-2 text-sm opacity-70">
        <span>Looking for third party managed hosting?</span>
        <Link
          external
          class="link flex justify-center items-center gap-1"
          href="https://lnvps.net/">
          Try lnvps.net
          <Icon icon={ArrowRight} />
        </Link>
      </div>
    </div>
  </PageContent>
</Page>
