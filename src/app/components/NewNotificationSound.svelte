<script lang="ts">
  import {onMount} from "svelte"
  import {userSettingsValues} from "@app/core/state"
  import {notifications} from "../util/notifications"

  let audioElement: HTMLAudioElement

  let enabled = $state(false)

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      enabled = true
    } else {
      enabled = false
    }
  })
  let notificationCount = $state($notifications.size)

  const playSound = () => {
    if (enabled && $userSettingsValues.play_notification_sound) {
      audioElement.play()
    }
  }

  onMount(() => {
    audioElement.load()

    notifications.subscribe(notifications => {
      if (notifications.size > notificationCount) {
        playSound()
      }

      notificationCount = notifications.size
    })
  })
</script>

<audio bind:this={audioElement} src="/new-notification-3-398649.mp3"></audio>
