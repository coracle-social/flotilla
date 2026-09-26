<script lang="ts">
  import {maybe} from "@welshman/lib"
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    src: string
    alt: string
    size?: number
    class?: string
    style?: string
  }

  const {src, alt, size = 5, style, class: className}: Props = $props()

  const rem = size * 0.25

  const imgStyle = $derived(
    `width: ${rem}rem; height: ${rem}rem; min-width: ${rem}rem; min-height: ${rem}rem${style ? `; ${style}` : ""}`,
  )

  // The ios wkwebview has no "Safari" token in its user agent, so detect the engine instead.
  const isWebkit =
    typeof navigator !== "undefined" &&
    /applewebkit/i.test(navigator.userAgent) &&
    !/chrome|chromium|android|firefox/i.test(navigator.userAgent)

  // Strip any query string/fragment - hosted icons are often served with one.
  const isRemoteSvg = (value: string) =>
    !value.startsWith("data:") && /\.svg$/i.test(value.split(/[?#]/)[0]!)

  // Primal issues 302 redirects from blossom, which breaks mask-image on webkit.
  const fetchSvg = async (url: string) => {
    try {
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
      })

      if (response.ok) {
        return URL.createObjectURL(await response.blob())
      }
    } catch {
      // pass
    }
  }

  let objectUrl = $state(maybe<string>())

  $effect(() => {
    const url = src

    let canceled = false
    let created: string | undefined

    if (isWebkit && isRemoteSvg(url)) {
      fetchSvg(url).then(blobUrl => {
        if (!blobUrl) {
          return
        }

        if (canceled) {
          URL.revokeObjectURL(blobUrl)
        } else {
          created = blobUrl
          objectUrl = blobUrl
        }
      })
    }

    return () => {
      canceled = true

      if (created) {
        URL.revokeObjectURL(created)
        objectUrl = undefined
      }
    }
  })
</script>

{#if src.includes("image/svg") || src.endsWith(".svg")}
  <Icon icon={objectUrl || src} {size} {style} class={className} />
{:else}
  <img {src} {alt} style={imgStyle} class="aspect-square object-cover {className}" />
{/if}
