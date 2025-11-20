<script lang="ts">
  import {sleep} from "@welshman/lib"
  import {getTagValue, getAddress, RelayMode} from "@welshman/util"
  import {isRelayFeed, findFeed} from "@welshman/feeds"
  import {getPubkeyRelays, pubkey} from "@welshman/app"
  import Inbox from "@assets/icons/inbox.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import AlertAdd from "@app/components/AlertAdd.svelte"
  import AlertItem from "@app/components/AlertItem.svelte"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {
    alerts,
    dmAlert,
    deriveAlertStatus,
    getAlertFeed,
    userSettingsValues,
  } from "@app/core/state"
  import {deleteAlert, createDmAlert} from "@app/core/commands"
  import {clearBadges} from "../util/notifications"

  type Props = {
    url?: string
    channel?: string
    hideSpaceField?: boolean
  }

  const {url = "", channel = "push", hideSpaceField = false}: Props = $props()

  const dmStatus = $derived($dmAlert ? deriveAlertStatus(getAddress($dmAlert.event)) : undefined)

  const filteredAlerts = $derived(
    $alerts.filter(alert => {
      const feed = getAlertFeed(alert)

      // Skip non-feeds and DM alerts
      if (!feed || alert === $dmAlert) return false

      // If we have a space url, only match feeds for this space
      if (url) return findFeed(feed, f => isRelayFeed(f) && f.includes(url))

      return true
    }),
  )

  const startAlert = () => pushModal(AlertAdd, {url, channel, hideSpaceField})

  const uncheckDmAlert = async (message: string) => {
    await sleep(100)

    directMessagesNotificationToggle.checked = false
    pushToast({theme: "error", message})
  }

  const onDirectMessagesNotificationToggle = async () => {
    if ($dmAlert) {
      deleteAlert($dmAlert)
    } else {
      if (getPubkeyRelays($pubkey!, RelayMode.Messaging).length === 0) {
        return uncheckDmAlert("Please set up your messaging relays before enabling alerts.")
      }

      const {error} = await createDmAlert()

      if (error) {
        return uncheckDmAlert(error)
      }

      pushToast({message: "Your alert has been successfully created!"})
    }
  }

  const onShowBadgeOnUnreadToggle = async () => {
    $userSettingsValues.show_notifications_badge = !$userSettingsValues.show_notifications_badge

    if (!$userSettingsValues.show_notifications_badge) {
      await clearBadges()
    }
  }

  const onDirectMessagesNotificationSoundToggle = async () => {
    $userSettingsValues.play_notification_sound = !$userSettingsValues.play_notification_sound
  }

  let directMessagesNotificationToggle: HTMLInputElement
</script>

<div class="col-4">
  <div class="card2 bg-alt flex flex-col gap-6 shadow-md">
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-3">
        <Icon icon={Inbox} />
        Alerts
      </strong>
      <Button class="btn btn-primary btn-sm" onclick={startAlert}>
        <Icon icon={AddCircle} />
        Add Alert
      </Button>
    </div>
    <div class="col-4">
      {#each filteredAlerts as alert (alert.event.id)}
        <AlertItem {alert} />
      {:else}
        <p class="text-center opacity-75 py-12">Nothing here yet!</p>
      {/each}
    </div>
  </div>
  <div class="card2 bg-alt flex flex-col gap-4 shadow-md">
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-3">
        <Icon icon={Bell} />
        Notifications
      </strong>
    </div>
    <div class="flex justify-between">
      <p>Notify me about new direct messages</p>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:this={directMessagesNotificationToggle}
        checked={Boolean($dmAlert)}
        oninput={onDirectMessagesNotificationToggle} />
    </div>
    <div class="flex justify-between">
      <p>Show badge for unread direct messages</p>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        checked={Boolean($userSettingsValues.show_notifications_badge)}
        oninput={onShowBadgeOnUnreadToggle} />
    </div>
    <div class="flex justify-between">
      <p>Play sound for new direct messages</p>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        checked={Boolean($userSettingsValues.play_notification_sound)}
        oninput={onDirectMessagesNotificationSoundToggle} />
    </div>
    {#if $dmStatus}
      {@const status = getTagValue("status", $dmStatus.tags) || "error"}
      {#if status !== "ok"}
        <div class="alert alert-error border border-solid border-error bg-transparent text-error">
          <p>
            {getTagValue("message", $dmStatus.tags) ||
              "The notification server did not respond to your request."}
          </p>
        </div>
      {/if}
    {/if}
  </div>
</div>
