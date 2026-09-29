<script lang="ts">
  import "leaflet/dist/leaflet.css"

  import {mount, onMount, unmount} from "svelte"
  import type {Map as LeafletMap, Marker, TileLayer} from "leaflet"
  import type {Maybe} from "@welshman/lib"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import {dufflepud} from "@app/env"
  import {pushModal} from "@app/modal"
  import {activeTheme} from "@app/theme"
  import type {MemberPin} from "@app/social"

  type Props = {
    url: string
    pins: MemberPin[]
  }

  const {url, pins}: Props = $props()

  const basemap = $derived($activeTheme === "dark" ? "dark_all" : "light_all")

  const openProfile = (pubkey: string) => pushModal(ProfileDetail, {pubkey, url})

  let element: HTMLElement
  let leaflet: Maybe<typeof import("leaflet")> = $state()
  let map: Maybe<LeafletMap> = $state()

  $effect(() => {
    if (leaflet) {
      const created = leaflet
        .map(element, {worldCopyJump: true, zoomControl: false})
        .setView([25, 0], 2)

      leaflet.control.zoom({position: "bottomright"}).addTo(created)
      map = created

      return () => created.remove()
    }
  })

  $effect(() => {
    let tile: Maybe<TileLayer>

    if (leaflet && map) {
      tile = leaflet
        .tileLayer(dufflepud(`basemap/${basemap}/{z}/{x}/{y}.png`), {
          maxZoom: 12,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution/">CARTO</a>',
        })
        .addTo(map)
    }

    return () => tile?.remove()
  })

  $effect(() => {
    const markers: Marker[] = []
    const avatars: Record<string, unknown>[] = []

    if (leaflet && map) {
      for (const pin of pins) {
        const target = document.createElement("div")

        target.className =
          "flex size-11 items-center justify-center rounded-full border border-line bg-surface shadow-lg"

        avatars.push(
          mount(ProfileCircle, {
            target,
            props: {pubkey: pin.pubkey, url, size: 9},
          }),
        )

        markers.push(
          leaflet
            .marker([pin.latitude, pin.longitude], {
              title: pin.display,
              // An empty className replaces the white box leaflet gives a div icon.
              icon: leaflet.divIcon({html: target, className: "", iconSize: [48, 48]}),
            })
            .on("click", () => openProfile(pin.pubkey))
            .addTo(map),
        )
      }

      if (markers.length > 0) {
        map.fitBounds(leaflet.featureGroup(markers).getBounds(), {maxZoom: 8, padding: [40, 40]})
      }
    }

    return () => {
      markers.forEach(marker => marker.remove())
      avatars.forEach(avatar => unmount(avatar))
    }
  })

  onMount(async () => {
    leaflet = await import("leaflet")
  })
</script>

<!-- Leaflet's panes sit at z-index 400, which covers a modal without a stacking context here. -->
<div bind:this={element} class="isolate min-h-96 flex-1 overflow-hidden rounded-2xl"></div>
