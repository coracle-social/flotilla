<script lang="ts">
  import cx from "classnames"
  import {sleep, remove} from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import {Capacitor} from "@capacitor/core"
  import {Badge} from "@capawesome/capacitor-badge"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {pushToast} from "@app/util/toast"
  import {Push, clearBadges} from "@app/util/notifications"
  import {userSettingsValues, splitRoomId} from "@app/core/state"
  import {publishSettings} from "@app/core/commands"

  const reset = () => {
    settings = {...$userSettingsValues}
  }

  const onAlertsBadgeChange = () => {
    if (!settings.alerts_badge) {
      clearBadges()
    }
  }

  const onAlertsPushChange = () => {
    if (settings.alerts_push) {
      Push.request().then(permissions => {
        if (permissions !== "granted") {
          sleep(300).then(() => {
            settings.alerts_push = false

            pushToast({
              theme: "error",
              message: "Failed to request notification permissions.",
            })
          })
        }
      })
    }
  }

  const removeMutedRoom = (id: string) => {
    settings.muted_rooms = remove(id, settings.muted_rooms)
  }

  const onsubmit = preventDefault(async () => {
    await publishSettings($state.snapshot(settings))

    pushToast({message: "Your settings have been saved!"})
  })

  let settings = $state({...$userSettingsValues})
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
            bind:checked={settings.alerts_badge}
            onchange={onAlertsBadgeChange} />
        </div>
      {/if}
    {/await}
    {#if !Capacitor.isNativePlatform()}
      <div class="flex justify-between">
        <p>Play sound for new activity</p>
        <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.alerts_sound} />
      </div>
    {/if}
    <div class="flex justify-between">
      <p>Enable push notifications</p>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={settings.alerts_push}
        onchange={onAlertsPushChange} />
    </div>
  </div>
  <div
    class={cx("card2 bg-alt col-4 shadow-md", {
      "pointer-events-none opacity-50":
        !settings.alerts_badge && !settings.alerts_sound && !settings.alerts_push,
    })}>
    <strong class="text-lg">Alert Types</strong>
    <div class="flex justify-between">
      <p>Notify me about new activity</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.alerts_spaces} />
    </div>
    <div class="flex justify-between">
      <p>Always notify me when mentioned</p>
      <input type="checkbox" class="toggle toggle-primary" checked={settings.alerts_mentions} />
    </div>
    <div class="flex justify-between">
      <p>Notify me about new messages</p>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={settings.alerts_messages} />
    </div>
  </div>
  <div
    class={cx("card2 bg-alt col-4 shadow-md", {
      "pointer-events-none opacity-50":
        !settings.alerts_badge && !settings.alerts_sound && !settings.alerts_push,
    })}>
    <strong class="text-lg">Muted Rooms</strong>
    {#each settings.muted_rooms as id (id)}
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
    <Button class="btn btn-neutral" onclick={reset}>Discard Changes</Button>
    <Button type="submit" class="btn btn-primary">Save Changes</Button>
  </div>
</form>
