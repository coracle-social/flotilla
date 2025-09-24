<script lang="ts">
  import {onMount} from "svelte"
  import {userSettingsValues} from "@app/core/state"
  import {notifications} from "../util/notifications"

  let audioElement: HTMLAudioElement

  let notificationCount = $state($notifications.size)

  const playSound = () => {
    if ($userSettingsValues.play_notification_sound) {
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
