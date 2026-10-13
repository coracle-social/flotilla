<script lang="ts">
  import cx from "classnames"
  import {isMobile} from "@lib/html"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import {profiles} from "@app/core/plugins"

  type Props = {
    pubkeys: string[]
    size?: number
    limit?: number
    class?: string
  }

  const {pubkeys, size = 7, limit, class: className}: Props = $props()
  const effectiveLimit = $derived(limit ?? (isMobile ? 7 : 10))

  const dimensions = $derived(
    size <= 5
      ? {box: "h-5 w-5", overlap: "-mr-2", overflow: "text-[9px]"}
      : size <= 6
        ? {box: "h-6 w-6", overlap: "-mr-2.5", overflow: "text-[10px]"}
        : {box: "h-8 w-8", overlap: "-mr-3", overflow: "text-xs"},
  )

  $effect(() => {
    for (const pk of pubkeys) {
      $profiles.load(pk)
    }
  })

  const displayPubkeys = $derived([...pubkeys].toSorted().slice(0, effectiveLimit))
  const overflowCount = $derived(Math.max(0, pubkeys.length - effectiveLimit))
</script>

<div class={cx("flex", size <= 5 ? "pr-2" : "pr-3", className)}>
  {#each displayPubkeys as pubkey (pubkey)}
    <div
      class={cx(
        "z-feature inline-block flex items-center justify-center rounded-full bg-surface",
        dimensions.box,
        dimensions.overlap,
      )}>
      <ProfileCircle class={cx(dimensions.box, "bg-surface-more")} {pubkey} {size} />
    </div>
  {/each}
  {#if overflowCount > 0}
    <div
      class={cx(
        "z-feature inline-flex items-center justify-center rounded-full bg-surface font-medium text-content",
        dimensions.box,
        dimensions.overlap,
        dimensions.overflow,
      )}>
      +{overflowCount}
    </div>
  {/if}
</div>
