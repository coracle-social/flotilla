<script lang="ts">
  import {onMount} from "svelte"
  import QrScanner from "qr-scanner"
  import Spinner from "@lib/components/Spinner.svelte"

  const {onscan} = $props()

  let video: HTMLVideoElement
  let scanner: QrScanner
  let loading = $state(true)

  onMount(() => {
    scanner = new QrScanner(video, r => onscan(r.data), {
      returnDetailedScanResult: true,
    })

    scanner.start().then(() => {
      loading = false
    })

    return () => scanner.destroy()
  })
</script>

<div class="bg-alt flex min-h-48 w-full flex-col items-center justify-center rounded p-px">
  {#if loading}
    <p class="py-20">
      <Spinner loading>Loading your camera...</Spinner>
    </p>
  {/if}
  <video class="m-auto rounded" class:h-0={loading} bind:this={video}></video>
</div>
