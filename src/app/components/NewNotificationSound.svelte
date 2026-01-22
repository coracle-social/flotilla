<script lang="ts">
  import {onMount} from "svelte"
  import {userSettingsValues} from "@app/core/state"
  import {onNotification} from "@app/util/notifications"

  let audioElement: HTMLAudioElement

  let enabled = $state(false)

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      enabled = true
    } else {
      enabled = false
    }
  })

  onMount(() => {
    audioElement.load()

    const unsubscribe = onNotification(() => {
      if (enabled && $userSettingsValues.alerts_sound) {
        audioElement?.play()
      }
    })

    return unsubscribe
  })
</script>

<audio bind:this={audioElement} src="/new-notification-3-398649.mp3"></audio>
