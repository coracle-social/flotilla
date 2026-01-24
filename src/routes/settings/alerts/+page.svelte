<script lang="ts">
  import cx from "classnames"
  import {sleep, equals, remove} from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import {Capacitor} from "@capacitor/core"
  import {Badge} from "@capawesome/capacitor-badge"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {pushToast} from "@app/util/toast"
  import {Push, clearBadges} from "@app/util/notifications"
  import {notificationSettings, userSettingsValues, splitRoomId} from "@app/core/state"
  import {publishSettings} from "@app/core/commands"

  const reset = () => {
    settings = {...notificationSettings.get()}
  }

  const removeMutedRoom = (id: string) => {
    muted_rooms = remove(id, muted_rooms)
  }

  const onsubmit = preventDefault(async () => {
    loading = true

    try {
      if (!settings.badge) {
        clearBadges()
      }

      if (settings.push) {
        const permissions = await Push.request()

        if (permissions !== "granted") {
          await sleep(300)

          settings.push = false

          pushToast({
            theme: "error",
            message: "Failed to request notification permissions.",
          })

          return
        }

        await Push.enable()
        await Push.start()
      } else {
        await Push.disable()
      }

      if (!equals(muted_rooms, $userSettingsValues.muted_rooms)) {
        publishSettings($state.snapshot({...$userSettingsValues, muted_rooms}))
      }

      notificationSettings.set(settings)

      pushToast({message: "Your settings have been saved!"})
    } finally {
      loading = false
    }
  })

  let loading = $state(false)
  let settings = $state({...notificationSettings.get()})
  let muted_rooms = $state($userSettingsValues.muted_rooms)
</script>

<form class="content column gap-4" {onsubmit}>
  <div class="card2 bg-alt col-4 shadow-md">
    <strong class="text-lg">Alert Settings</strong>
    {#await Badge.isSupported()}
      <!-- pass -->
    {:then { isSupported }}
      {#if isSupported}
        <div class="flex justify-between">
          <p>Show badge for unread alerts</p>
          <input
            type="checkbox"
            class="toggle toggle-primary"
            bind:checked={settings.badge} />
        </div>
      {/if}
    {/await}
    {#if !Capacitor.isNativePlatform()}
      <div class="flex justify-between">
        <p>Play sound for new activity</p>
        <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.sound} />
      </div>
    {/if}
    <div class="flex justify-between">
      <p>Enable push notifications</p>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={settings.push} />
    </div>
  </div>
  <div
    class={cx("card2 bg-alt col-4 shadow-md", {
      "pointer-events-none opacity-50":
        !settings.badge && !settings.sound && !settings.push,
    })}>
    <strong class="text-lg">Alert Types</strong>
    <div class="flex justify-between">
      <p>Notify me about new activity</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.spaces} />
    </div>
    <div class="flex justify-between">
      <p>Always notify me when mentioned</p>
      <input type="checkbox" class="toggle toggle-primary" checked={settings.mentions} />
    </div>
    <div class="flex justify-between">
      <p>Notify me about new messages</p>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={settings.messages} />
    </div>
  </div>
  <div
    class={cx("card2 bg-alt col-4 shadow-md", {
      "pointer-events-none opacity-50":
        !settings.badge && !settings.sound && !settings.push,
    })}>
    <strong class="text-lg">Muted Rooms</strong>
    {#each muted_rooms as id (id)}
      {@const [url, h] = splitRoomId(id)}
      <div class="flex-inline badge badge-neutral mr-1 gap-1">
        <Button class="flex items-center" onclick={() => removeMutedRoom(id)}>
          <Icon icon={CloseCircle} size={4} class="-ml-1 mt-px" />
        </Button>
        Room "<RoomName {url} {h} />" on {displayRelayUrl(url)}
      </div>
    {:else}
      <p class="flex items-center justify-center text-sm py-4 opacity-70">No muted rooms found.</p>
    {/each}
  </div>
  <div class="mt-4 flex flex-row items-center justify-between gap-4">
    <Button class="btn btn-neutral" onclick={reset} disabled={loading}>Discard Changes</Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Save Changes</Spinner>
    </Button>
  </div>
</form>
