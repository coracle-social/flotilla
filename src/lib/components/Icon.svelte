<style>
  div {
    mask-repeat: no-repeat;
    mask-size: 100% 100%;
  }
</style>

<script lang="ts">
  import {onMount} from "svelte"
  import {maybe} from "@welshman/lib"

  const {
    icon,
    size = 5,
    ...restProps
  }: {
    icon: string
    size?: number
    class?: string
  } = $props()

  const px = size * 4

  const isSafari =
    typeof navigator !== "undefined" &&
    /safari/i.test(navigator.userAgent) &&
    !/chrome|chromium|android/i.test(navigator.userAgent)

  let canceled = false
  let objectUrl = $state(maybe<string>())

  const src = $derived(objectUrl || icon)

  // Primal issues 302 redirects from blossom, which messes up safari
  const fetchSvg = async () => {
    try {
      const response = await fetch(icon, {
        mode: "cors",
        credentials: "omit",
      })

      if (response.ok) {
        const blob = await response.blob()

        if (!canceled) {
          objectUrl = URL.createObjectURL(blob)
        }
      }
    } catch {
      // pass
    }
  }

  onMount(() => {
    if (isSafari && icon.toLowerCase().endsWith(".svg")) {
      fetchSvg()
    }

    return () => {
      canceled = true

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  })
</script>

<div
  class="inline-block {restProps.class}"
  style="mask-image: url({src}); width: {px}px; height: {px}px; min-width: {px}px; min-height: {px}px; background-color: currentcolor;">
</div>
