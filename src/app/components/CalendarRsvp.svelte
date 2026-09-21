<script lang="ts">
  import cx from "classnames"
  import type {TrustedEvent} from "@welshman/util"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import QuestionCircle from "@assets/icons/question-circle.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import {user} from "@app/core"
  import {
    RsvpStatus,
    getRsvpStatus,
    getRsvpsByStatus,
    publishRsvp,
    retractRsvp,
  } from "@app/calendar"

  type Props = {
    url: string
    event: TrustedEvent
    rsvps: TrustedEvent[]
    onShowPeople?: () => void
  }

  const {url, event, rsvps, onShowPeople}: Props = $props()

  const setStatus = async (status: RsvpStatus) => {
    if (loading) {
      return
    }

    loading = true

    try {
      if (ownRsvp && getRsvpStatus(ownRsvp) === status) {
        await retractRsvp(url, ownRsvp)
      } else {
        await publishRsvp(url, event, status)
      }
    } finally {
      loading = false
    }
  }

  const accept = () => setStatus(RsvpStatus.Accepted)

  const maybe = () => setStatus(RsvpStatus.Tentative)

  const decline = () => setStatus(RsvpStatus.Declined)

  const statusClass = (status: RsvpStatus) =>
    cx("button button-xs join-item", ownStatus === status ? "button-primary" : "button-neutral")

  let loading = $state(false)

  const people = $derived(getRsvpsByStatus(rsvps))
  const ownRsvp = $derived(people.latest.find(rsvp => rsvp.pubkey === $user.pubkey))
  const ownStatus = $derived(ownRsvp ? getRsvpStatus(ownRsvp) : undefined)
  const attending = $derived([...people.accepted, ...people.tentative])
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-wrap items-center gap-2">
    <span class="text-sm opacity-75">Are you going?</span>
    <div class="join">
      <Button class={statusClass(RsvpStatus.Accepted)} disabled={loading} onclick={accept}>
        <Icon icon={CheckCircle} size={4} />
        Going
      </Button>
      <Button class={statusClass(RsvpStatus.Tentative)} disabled={loading} onclick={maybe}>
        <Icon icon={QuestionCircle} size={4} />
        Maybe
      </Button>
      <Button class={statusClass(RsvpStatus.Declined)} disabled={loading} onclick={decline}>
        <Icon icon={CloseCircle} size={4} />
        Can't go
      </Button>
    </div>
    {#if loading}
      <Spinner size="xs" />
    {/if}
  </div>
  {#if attending.length > 0}
    {@const summary = [
      `${people.accepted.length} going`,
      people.tentative.length > 0 ? `${people.tentative.length} maybe` : undefined,
      people.declined.length > 0 ? `${people.declined.length} can't go` : undefined,
    ]
      .filter(Boolean)
      .join(" · ")}
    <!-- The roll-up is the natural way into the guest list, so make it the link to it -->
    {#if onShowPeople}
      <Button class="flex items-center gap-2 self-start text-sm" onclick={onShowPeople}>
        <ProfileCircles pubkeys={attending} size={6} />
        <span class="opacity-75 hover:opacity-100">{summary}</span>
      </Button>
    {:else}
      <div class="flex items-center gap-2 text-sm">
        <ProfileCircles pubkeys={attending} size={6} />
        <span class="opacity-75">{summary}</span>
      </div>
    {/if}
  {/if}
</div>
