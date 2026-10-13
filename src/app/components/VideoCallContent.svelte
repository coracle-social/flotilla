<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import cx from "classnames"
  import {Track} from "livekit-client"
  import Pin from "@assets/icons/pin.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {computeAdaptiveGrid} from "@lib/tileGrid"
  import type {AdaptiveTileGrid} from "@lib/tileGrid"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import VideoCallTile from "@app/components/VideoCallTile.svelte"
  import VoiceParticipantMediaBadges from "@app/components/VoiceParticipantMediaBadges.svelte"
  import {
    syncVideoSpotlight,
    toggleVideoPrimaryTile,
    videoPrimaryTileKey,
    currentCallSession,
    callTargetRoom,
    mediaStateByIdentity,
    participantMediaState,
    pubkeyFromLiveKitIdentity,
    videoTrackRevision,
  } from "@app/features/call"
  import {getVideoTileKey, getVideoTiles} from "@app/features/callEngine"
  import type {VideoTile} from "@app/features/callEngine"
  import {deriveDisplaysByPubkey} from "@app/features/social"

  type Props = {
    url: string
    h: string
    class?: string
  }

  type TileLayoutVariant = "spotlight" | "default" | "strip"

  const {url, h, class: className}: Props = $props()

  const videoTiles = $derived.by(() => {
    // LiveKit mutates remoteParticipants and tracks in place, so these stores are what change.
    void $participantMediaState
    void $videoTrackRevision

    return $currentCallSession && $callTargetRoom?.url === url && $callTargetRoom?.h === h
      ? getVideoTiles($currentCallSession)
      : []
  })

  const primaryTile = $derived(videoTiles.find(t => getVideoTileKey(t) === $videoPrimaryTileKey))

  const secondaryTiles = $derived(videoTiles.filter(t => t !== primaryTile))

  let gridWidth = $state(0)
  let gridHeight = $state(0)

  const tileGrid = $derived<AdaptiveTileGrid | undefined>(
    primaryTile ? undefined : computeAdaptiveGrid(videoTiles.length, gridWidth, gridHeight),
  )

  $effect(() => {
    syncVideoSpotlight(
      videoTiles.map(getVideoTileKey),
      videoTiles.filter(t => t.source === Track.Source.ScreenShare).map(getVideoTileKey),
    )
  })

  const displays = $derived(
    deriveDisplaysByPubkey(
      removeUndefined(videoTiles.map(t => pubkeyFromLiveKitIdentity(t.liveKitIdentity))),
      url,
    ),
  )

  const labelFor = (liveKitIdentity: string, source: VideoTile["source"]) => {
    const pk = pubkeyFromLiveKitIdentity(liveKitIdentity)
    const name = (pk && $displays.get(pk)) || "Unknown"

    return source === Track.Source.ScreenShare ? `${name} · screen` : name
  }

  const showTileGrid = $derived(videoTiles.length > 0)

  const spotlightHandlerFor = (key: string) => () => {
    toggleVideoPrimaryTile(key)
  }
</script>

{#snippet videoTile(tile: VideoTile, layout: TileLayoutVariant)}
  {@const media = $mediaStateByIdentity(tile.liveKitIdentity)}
  {@const label = labelFor(tile.liveKitIdentity, tile.source)}
  <div
    class={cx(
      // bg-surface-more so a camera-off tile reads as its own card instead of blending into the panel.
      "relative isolate overflow-hidden rounded-2xl border border-line shadow-sm",
      layout === "spotlight" && "min-h-0 flex-1",
      layout === "default" && "min-h-0 h-full w-full",
      layout === "strip" && "aspect-video w-44 shrink-0",
      tile.source === Track.Source.ScreenShare ? "bg-black" : "bg-surface-more",
    )}>
    {#if tile.track}
      <VideoCallTile
        track={tile.track}
        muted={tile.isLocal}
        fit={tile.source === Track.Source.ScreenShare ? "contain" : "cover"}
        class="pointer-events-none absolute inset-0" />
    {:else}
      <div class="absolute inset-0 flex items-center justify-center">
        <ProfileCircle pubkey={pubkeyFromLiveKitIdentity(tile.liveKitIdentity)} {url} size={14} />
      </div>
    {/if}
    {#if tile.track}
      <div class="pointer-events-none absolute left-1 top-1 z-10">
        <VoiceParticipantMediaBadges
          muted={media.muted}
          cameraOn={media.cameraOn}
          showCamera={tile.source === Track.Source.Camera}
          size={3} />
      </div>
    {/if}
    <span
      class="pointer-events-none absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-surface/80 px-1.5 py-0.5 text-xs">
      {label}{tile.isLocal ? " (you)" : ""}
    </span>
    {#if videoTiles.length > 1}
      {@const pinned = $videoPrimaryTileKey === getVideoTileKey(tile)}
      <Button
        data-tip={pinned ? "Exit spotlight" : "Spotlight"}
        aria-label={pinned ? `Exit spotlight for ${label}` : `Spotlight ${label}`}
        aria-pressed={pinned}
        class={cx(
          `button button-${pinned ? "primary" : "ghost"} button-xs button-square`,
          "absolute right-1 top-1 z-20",
          !pinned && "bg-surface",
        )}
        onclick={spotlightHandlerFor(getVideoTileKey(tile))}>
        <Icon icon={Pin} size={3} />
      </Button>
    {/if}
  </div>
{/snippet}

{#snippet videoPanelBody()}
  {#if showTileGrid}
    {#if primaryTile}
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {@render videoTile(primaryTile, "spotlight")}
        {#if secondaryTiles.length > 0}
          <div
            class="flex max-h-40 shrink-0 flex-row gap-2 overflow-x-auto overflow-y-hidden py-0.5">
            {#each secondaryTiles as tile (getVideoTileKey(tile))}
              {@render videoTile(tile, "strip")}
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div
        bind:clientWidth={gridWidth}
        bind:clientHeight={gridHeight}
        class="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable_both-edges]">
        {#if tileGrid}
          <div class="flex flex-col items-center gap-2">
            {#each tileGrid.rows as row, rowIndex (rowIndex)}
              {@const offset = tileGrid.rows
                .slice(0, rowIndex)
                .reduce((sum, r) => sum + r.columnCount, 0)}
              <div
                class="flex flex-nowrap justify-center gap-2"
                style={`max-width: ${row.rowWidth}px`}>
                {#each videoTiles.slice(offset, offset + row.columnCount) as tile (getVideoTileKey(tile))}
                  <div
                    class="overflow-hidden rounded-2xl shrink-0"
                    style={`width: ${row.tileWidth}px; height: ${row.tileHeight}px`}>
                    {@render videoTile(tile, "default")}
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div
      class="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface-more p-4 text-center text-sm opacity-80">
      <p>Waiting for participants…</p>
    </div>
  {/if}
{/snippet}

<div class={cx("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2", className)}>
  {@render videoPanelBody()}
</div>
