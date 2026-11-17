<script lang="ts">
  import {onMount} from "svelte"
  import {Capacitor} from "@capacitor/core"
  import {alertSettings} from "@app/tools/alerts/settings"
  import {onAlert} from "@app/tools/alerts/stream"

  let audioElement: HTMLAudioElement

  let enabled = $state(false)

  const onVisibilityChange = () => {
    if (document.hidden) {
      enabled = true
    } else {
      enabled = false
    }
  }

  onMount(() => {
    if (Capacitor.isNativePlatform()) {
      return
    }

    audioElement.load()

    document.addEventListener("visibilitychange", onVisibilityChange)

    const unsubscribe = onAlert(() => {
      if (enabled && $alertSettings.sound) {
        audioElement?.play()
      }
    })

    return () => {
      unsubscribe()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  })
</script>

<audio bind:this={audioElement} src="/new-notification-3-398649.mp3"></audio>
