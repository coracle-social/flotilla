<script lang="ts">
  import {onMount} from "svelte"
  import {preventDefault} from "@lib/html"
  import {randomInt, displayList, TIMEZONE, identity} from "@welshman/lib"
  import {displayRelayUrl, getTagValue, THREAD, MESSAGE, EVENT_TIME, COMMENT} from "@welshman/util"
  import type {Filter} from "@welshman/util"
  import {makeIntersectionFeed, makeRelayFeed, feedFromFilters} from "@welshman/feeds"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {alerts, userSpaceUrls} from "@app/core/state"
  import {requestRelayClaim} from "@app/core/requests"
  import {createAlert} from "@app/core/commands"
  import {canSendPushNotifications} from "@app/util/push"
  import {pushToast} from "@app/util/toast"

  type Props = {
    url?: string
    room?: string
    notifyChat?: boolean
    notifyThreads?: boolean
    notifyCalendar?: boolean
    hideSpaceField?: boolean
  }

  let {
    url = "",
    room = "email",
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
  let email = $state($alerts.map(a => getTagValue("email", a.tags)).filter(identity)[0] || "")

  const back = () => history.back()

  const submit = async () => {
    if (room === "email" && !email.includes("@")) {
      return pushToast({
        theme: "error",
        message: "Please provide an email address",
      })
    }

    if (!url) {
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
      const claim = url ? await requestRelayClaim(url) : undefined

      const {error} = await createAlert({
        feed: makeIntersectionFeed(feedFromFilters(filters), makeRelayFeed(url)),
        claims: claim ? {[url]: claim} : {},
        description: `for ${displayList(display)} on ${displayRelayUrl(url)}`,
        email: room === "email" ? {cron, email} : undefined,
      })

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Your alert has been successfully created!"})
        back()
      }
    } finally {
      loading = false
    }
  }

  onMount(() => {
    if (!canSendPushNotifications()) {
      room = "email"
    }
  })
</script>

<form class="column gap-4" onsubmit={preventDefault(submit)}>
  <ModalHeader>
    {#snippet title()}
      Add an Alert
    {/snippet}
    {#snippet info()}
      Enable notifications to keep up to date on activity you care about.
    {/snippet}
  </ModalHeader>
  {#if canSendPushNotifications()}
    <FieldInline>
      {#snippet label()}
        <p>Alert Type*</p>
      {/snippet}
      {#snippet input()}
        <select bind:value={room} class="select select-bordered">
          <option value="email">Email Digest</option>
          <option value="push">Push Notification</option>
        </select>
      {/snippet}
    </FieldInline>
  {/if}
  {#if room === "email"}
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
        <select bind:value={url} class="select select-bordered">
          <option value="" disabled selected>Choose a space URL</option>
          {#each $userSpaceUrls as url (url)}
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
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Confirm</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</form>
