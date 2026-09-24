<style>
  div {
    mask-repeat: no-repeat;
    mask-size: 100% 100%;
  }
</style>

<script lang="ts">
  import {maybe} from "@welshman/lib"

  const {
    icon,
    size = 5,
    ...restProps
  }: {
    icon: string
    size?: number
    class?: string
    style?: string
  } = $props()

  const px = size * 4

  // The ios wkwebview has no "Safari" token in its user agent, so detect the engine instead.
  const isWebkit =
    typeof navigator !== "undefined" &&
    /applewebkit/i.test(navigator.userAgent) &&
    !/chrome|chromium|android|firefox/i.test(navigator.userAgent)

  // Strip any query string/fragment - hosted icons are often served with one.
  const isRemoteSvg = (value: string) =>
    !value.startsWith("data:") && /\.svg$/i.test(value.split(/[?#]/)[0]!)

  let objectUrl = $state(maybe<string>())

  const src = $derived(objectUrl || icon)

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

  // Re-fetch when icon changes, revoking the previous blob url.
  $effect(() => {
    const url = icon

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

<div
  class="inline-block {restProps.class}"
  style="mask-image: url({src}); width: {px}px; height: {px}px; min-width: {px}px; min-height: {px}px; background-color: currentcolor; {restProps.style ??
    ''}">
</div>
