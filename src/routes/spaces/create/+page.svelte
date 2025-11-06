<script lang="ts">
  import Server from "@assets/icons/server.svg?dataurl"
  import ArrowRight from "@assets/icons/arrow-right.svg?dataurl"
  import HandShake from "@assets/icons/hand-shake.svg?dataurl"
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageHeader from "@lib/components/PageHeader.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
</script>

<Page class="cw-full">
  <PageContent class="cw-full flex flex-col items-center gap-2 p-2 pt-4">
    <PageHeader>
      {#snippet title()}
        <div>Create your own Space</div>
      {/snippet}
      {#snippet info()}
        <p>Get started with one of our trusted partners, or learn how to host your own space.</p>
      {/snippet}
    </PageHeader>
    <div class="grid w-full max-w-lg grid-cols-1 gap-2 lg:max-w-4xl lg:grid-cols-2">
      <div class="card2 bg-alt flex flex-col gap-4">
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Icon icon={Server} />
              <h3 class="text-lg font-bold">Self-Host your Space</h3>
            </div>
            <div class="badge badge-neutral">Recommended</div>
          </div>
          <ul class="flex list-inside list-disc flex-col gap-1 text-sm opacity-70">
            <li>Unlimited customization and control</li>
            <li>Free and open source software</li>
            <li>Full-featured admin dashboards available</li>
            <li>Requires some technical skills</li>
          </ul>
        </div>
        <Link external class="btn btn-primary" href="https://github.com/coracle-social/zooid">
          Get Started
          <Icon icon={ArrowRight} />
        </Link>
      </div>
      <div class="card2 bg-alt flex flex-col gap-4">
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img alt="Coracle Logo" src="/coracle.png" class="h-7 w-7" />
              <h3 class="text-lg font-bold">Coracle Hosting</h3>
            </div>
            <div class="badge badge-neutral">Recommended</div>
          </div>
          <ul class="flex list-inside list-disc flex-col gap-1 text-sm opacity-70">
            <li>Simple setup, support included</li>
            <li>Free and open source software — no vendor lock-in</li>
            <li>Advanced access controls and relay policies</li>
            <li>Full-featured admin dashboard</li>
          </ul>
        </div>
        <Link external class="btn btn-neutral" href="https://hosting.coracle.social">
          Get Started
          <Icon icon={ArrowRight} />
        </Link>
      </div>
      <div class="card2 bg-alt flex flex-col gap-4">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <Icon icon={HandShake} />
            <h3 class="text-lg font-bold">Holis Communities</h3>
          </div>
          <ul class="flex list-inside list-disc flex-col gap-1 text-sm opacity-70">
            <li>Simple self-serve space creation</li>
            <li>Built-in moderation tools</li>
            <li>Room-level access controls</li>
            <li>Membship lists and invite codes</li>
          </ul>
        </div>
        <Link external class="btn btn-neutral" href="https://hol.is">
          Get Started
          <Icon icon={ArrowRight} />
        </Link>
      </div>
      <div class="card2 bg-alt flex flex-col gap-4">
        <div class="flex flex-col gap-4">
          <div class="self-start">
            <img
              alt="Relay Tools"
              src="https://relay.tools/17.svg"
              class="-my-20 -ml-2 hidden h-48 dark:block"
              style="filter: contrast(50%)" />
            <img
              alt="Relay Tools"
              src="https://relay.tools/19.svg"
              class="-my-20 -ml-2 h-48 dark:hidden"
              style="filter: contrast(50%)" />
          </div>
          <ul class="flex list-inside list-disc flex-col gap-1 text-sm opacity-70">
            <li>Independently run</li>
            <li>Customizable relay policies</li>
            <li>Simple management dashboard</li>
            <li>Support available</li>
          </ul>
        </div>
        <Link external class="btn btn-neutral" href="https://relay.tools/signup">
          Get Started
          <Icon icon={ArrowRight} />
        </Link>
      </div>
    </div>
  </PageContent>
</Page>
