<script lang="ts">
  import {onMount} from "svelte"
  import QrScanner from "qr-scanner"
  import Spinner from "@lib/components/Spinner.svelte"

  const {onscan} = $props()

  const changeCamera = async () => {
    if (camera && scanner) {
      loading = true
      try {
        await scanner.setCamera(camera)
      } catch (error) {
        console.error("Failed to switch camera:", error)
      } finally {
        loading = false
      }
    }
  }

  let video: HTMLVideoElement
  let scanner: QrScanner
  let loading = $state(true)
  let cameras = $state<QrScanner.Camera[]>([])
  let camera = $state<string>("")

  onMount(() => {
    QrScanner.listCameras(true)
      .then(async () => {
        cameras = await QrScanner.listCameras(true)

        if (cameras.length > 0) {
          camera = cameras[0].id
        }
      })
      .catch(error => {
        console.error("Failed to list cameras:", error)
      })

    scanner = new QrScanner(video, r => onscan(r.data), {
      returnDetailedScanResult: true,
    })

    scanner.start().then(() => {
      loading = false
    })

    return () => scanner.destroy()
  })
</script>

<div class="bg-alt relative flex min-h-48 w-full flex-col items-center justify-center rounded p-px">
  {#if loading}
    <p class="py-20">
      <Spinner loading>Loading your camera...</Spinner>
    </p>
  {/if}
  <video class="m-auto rounded" class:h-0={loading} bind:this={video}></video>
  {#if cameras.length > 1}
    <select
      class="select select-bordered select-sm absolute bottom-1 right-1"
      bind:value={camera}
      onchange={changeCamera}>
      {#each cameras as camera}
        <option value={camera.id}>{camera.label || `Camera ${camera.id}`}</option>
      {/each}
    </select>
  {/if}
</div>
