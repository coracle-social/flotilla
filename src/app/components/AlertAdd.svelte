<script lang="ts">
  import {onMount} from "svelte"
  import {preventDefault} from "@lib/html"
  import {ucFirst} from "@lib/util"
  import {decrypt} from "@welshman/signer"
  import {randomInt, parseJson, fromPairs, displayList, TIMEZONE, identity} from "@welshman/lib"
  import {
    displayRelayUrl,
    getTagValue,
    getAddress,
    THREAD,
    MESSAGE,
    EVENT_TIME,
    COMMENT,
  } from "@welshman/util"
  import type {Filter} from "@welshman/util"
  import {makeIntersectionFeed, makeRelayFeed, feedFromFilters} from "@welshman/feeds"
  import {pubkey, signer, getThunkError} from "@welshman/app"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {
    alerts,
    getMembershipUrls,
    userMembership,
    NOTIFIER_PUBKEY,
    NOTIFIER_RELAY,
  } from "@app/state"
  import {loadAlertStatuses, requestRelayClaim} from "@app/requests"
  import {publishAlert, attemptAuth} from "@app/commands"
  import type {AlertParams} from "@app/commands"
  import {platform, canSendPushNotifications, getPushInfo} from "@app/push"
  import {pushToast} from "@app/toast"

  type Props = {
    channel?: string
    relay?: string
    notifyChat?: boolean
    notifyThreads?: boolean
    notifyCalendar?: boolean
    hideSpaceField?: boolean
  }

  let {
    relay = "",
    channel = "email",
    notifyChat = true,
    notifyThreads = true,
    notifyCalendar = true,
    hideSpaceField = false,
  }: Props = $props()

  const timezoneOffset = parseInt(TIMEZONE.slice(3)) / 100
  const minute = randomInt(0, 59)
  const hour = (17 - timezoneOffset) % 24
  const WEEKLY = `0 ${minute} ${hour} * * 1`
  const DAILY = `0 ${minute} ${hour} * * *`

  let loading = $state(false)
  let cron = $state(WEEKLY)
  let claim = $state("")
  let email = $state($alerts.map(a => getTagValue("email", a.tags)).filter(identity)[0] || "")

  const back = () => history.back()

  const submit = async () => {
    if (channel === "email" && !email.includes("@")) {
      return pushToast({
        theme: "error",
        message: "Please provide an email address",
      })
    }

    if (!relay) {
      return pushToast({
        theme: "error",
        message: "Please select a space",
      })
    }

    if (!notifyThreads && !notifyCalendar && !notifyChat) {
      return pushToast({
        theme: "error",
        message: "Please select something to be notified about",
      })
    }

    const filters: Filter[] = []
    const display: string[] = []

    if (notifyThreads) {
      display.push("threads")
      filters.push({kinds: [THREAD]})
      filters.push({kinds: [COMMENT], "#k": [String(THREAD)]})
    }

    if (notifyCalendar) {
      display.push("calendar events")
      filters.push({kinds: [EVENT_TIME]})
      filters.push({kinds: [COMMENT], "#k": [String(EVENT_TIME)]})
    }

    if (notifyChat) {
      display.push("chat")
      filters.push({kinds: [MESSAGE]})
    }

    loading = true

    try {
      const claims = claim ? {[relay]: claim} : {}
      const feed = makeIntersectionFeed(feedFromFilters(filters), makeRelayFeed(relay))
      const description = `for ${displayList(display)} on ${displayRelayUrl(relay)}`
      const params: AlertParams = {feed, claims, description}

      if (channel === "email") {
        const cadence = cron?.endsWith("1") ? "Weekly" : "Daily"

        params.description = `${cadence} alert ${description}, sent via email.`
        params.email = {
          cron,
          email,
          handler: [
            "31990:97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322:1737058597050",
            "wss://relay.nostr.band/",
            "web",
          ],
        }
      } else {
        try {
          // @ts-ignore
          params[platform] = await getPushInfo()
          params.description = `${ucFirst(platform)} push notification ${description}.`
        } catch (e: any) {
          return pushToast({
            theme: "error",
            message: String(e),
          })
        }
      }

      // If we don't do this we'll get an event rejection
      await attemptAuth(NOTIFIER_RELAY)

      const thunk = await publishAlert(params)
      const error = await getThunkError(thunk)

      if (error) {
        return pushToast({
          theme: "error",
          message: `Failed to send your alert to the notification server (${error}).`,
        })
      }

      // Fetch our new status to make sure it's active
      const address = getAddress(thunk.event)
      const statusEvents = await loadAlertStatuses($pubkey!)
      const statusEvent = statusEvents.find(event => getTagValue("d", event.tags) === address)
      const statusTags = statusEvent
        ? parseJson(await decrypt(signer.get(), NOTIFIER_PUBKEY, statusEvent.content))
        : []
      const {status = "error", message = "Your alert was not activated"}: Record<string, string> =
        fromPairs(statusTags)

      if (status === "error") {
        return pushToast({theme: "error", message})
      }

      pushToast({message: "Your alert has been successfully created!"})
      back()
    } finally {
      loading = false
    }
  }

  onMount(() => {
    if (!canSendPushNotifications()) {
      channel = "email"
    }

    requestRelayClaim(relay).then(code => {
      if (code) {
        claim = code
      }
    })
  })
</script>

<form class="column gap-4" onsubmit={preventDefault(submit)}>
  <ModalHeader>
    {#snippet title()}
      Add an Alert
    {/snippet}
  </ModalHeader>
  {#if canSendPushNotifications()}
    <FieldInline>
      {#snippet label()}
        <p>Alert Type*</p>
      {/snippet}
      {#snippet input()}
        <select bind:value={channel} class="select select-bordered">
          <option value="email">Email Digest</option>
          <option value="push">Push Notification</option>
        </select>
      {/snippet}
    </FieldInline>
  {/if}
  {#if channel === "email"}
    <FieldInline>
      {#snippet label()}
        <p>Email Address*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <input placeholder="email@example.com" bind:value={email} />
        </label>
      {/snippet}
    </FieldInline>
    <FieldInline>
      {#snippet label()}
        <p>Frequency*</p>
      {/snippet}
      {#snippet input()}
        <select bind:value={cron} class="select select-bordered">
          <option value={WEEKLY}>Weekly</option>
          <option value={DAILY}>Daily</option>
        </select>
      {/snippet}
    </FieldInline>
  {/if}
  {#if !hideSpaceField}
    <FieldInline>
      {#snippet label()}
        <p>Space*</p>
      {/snippet}
      {#snippet input()}
        <select bind:value={relay} class="select select-bordered">
          <option value="" disabled selected>Choose a space URL</option>
          {#each getMembershipUrls($userMembership) as url (url)}
            <option value={url}>{displayRelayUrl(url)}</option>
          {/each}
        </select>
      {/snippet}
    </FieldInline>
  {/if}
  <FieldInline>
    {#snippet label()}
      <p>Notifications*</p>
    {/snippet}
    {#snippet input()}
      <div class="flex items-center justify-end gap-4">
        <span class="flex gap-3">
          <input type="checkbox" class="checkbox" bind:checked={notifyThreads} />
          Threads
        </span>
        <span class="flex gap-3">
          <input type="checkbox" class="checkbox" bind:checked={notifyCalendar} />
          Calendar
        </span>
        <span class="flex gap-3">
          <input type="checkbox" class="checkbox" bind:checked={notifyChat} />
          Chat
        </span>
      </div>
    {/snippet}
  </FieldInline>
  <FieldInline>
    {#snippet label()}
      <p>Invite Code</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <input bind:value={claim} />
      </label>
    {/snippet}
    {#snippet info()}
      <p>
        To get notifications from private spaces, please provide an invite code which grants access
        to the space.
      </p>
    {/snippet}
  </FieldInline>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon="alt-arrow-left" />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Confirm</Spinner>
      <Icon icon="alt-arrow-right" />
    </Button>
  </ModalFooter>
</form>
