<script lang="ts">
  import {translate} from "@lib/transition"
  import Compass from "@assets/icons/compass.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import PrimaryNavSpaces from "@app/components/PrimaryNavSpaces.svelte"
  import {lastSpaceUrl} from "@app/routes"

  type Props = {
    url?: string
  }

  const {url}: Props = $props()

  const activeUrl = $derived($lastSpaceUrl ?? url)

  const duration = 200

  const parallax = 10

  const slide = (delay: number) => ({
    axis: "x" as const,
    offset: -100,
    unit: "cqw",
    duration,
    delay,
  })
</script>

<div class="@container flex h-full min-h-0 w-full">
  <div
    class="primary-nav flex min-h-0 pb-2"
    in:translate={slide(0)}
    out:translate={slide(parallax)}>
    <PrimaryNavSpaces />
  </div>
  <div class="flex w-0 min-w-0 grow" in:translate={slide(parallax)} out:translate={slide(0)}>
    <SecondaryNav visible class="secondary-nav--mobile-space mt-0 h-full w-0 min-w-0 grow pb-0">
      {#key activeUrl}
        {#if activeUrl}
          <SpaceMenu url={activeUrl} mobile />
        {:else}
          <SecondaryNavSection class="space-menu min-h-0 flex-1 flex flex-col justify-center">
            <div class="card space-menu__card flex flex-col items-center gap-3 text-center">
              <p class="text-content-muted">Spaces you join show up here.</p>
              <Link href="/spaces" class="button button-primary">
                <Icon icon={Compass} />
                Browse spaces
              </Link>
            </div>
          </SecondaryNavSection>
        {/if}
      {/key}
    </SecondaryNav>
  </div>
</div>
