<script lang="ts">
  import {translate} from "@lib/transition"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import PrimaryNavSpaces from "@app/components/PrimaryNavSpaces.svelte"
  import {lastSpaceUrl} from "@app/routes"

  type Props = {
    url: string
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
        <SpaceMenu url={activeUrl} mobile />
      {/key}
    </SecondaryNav>
  </div>
</div>
