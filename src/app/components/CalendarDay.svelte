<script lang="ts">
  import type {Readable} from "svelte/store"
  import type {TrustedEvent} from "@welshman/util"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import CalendarEventItem from "@app/components/CalendarEventItem.svelte"
  import CalendarEventCreate from "@app/components/CalendarEventCreate.svelte"
  import type {FeedContext} from "@app/feeds"
  import {formatDay, groupEventsByDay, makeDayKey} from "@app/calendar"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    date: Date
    events: Readable<TrustedEvent[]>
    context: FeedContext
  }

  const {url, date, events, context}: Props = $props()

  // A modal's props are frozen at push time, so re-derive from the feed's own store.
  const dayEvents = $derived(groupEventsByDay($events).get(makeDayKey(date)) ?? [])

  const back = () => history.back()

  const makeEvent = () => pushModal(CalendarEventCreate, {url, date}, {nested: true})
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{formatDay(date)}</ModalTitle>
      <ModalSubtitle>
        {dayEvents.length === 1 ? "1 event" : `${dayEvents.length} events`}
      </ModalSubtitle>
    </ModalHeader>
    {#each dayEvents as event (event.id)}
      <CalendarEventItem {url} {event} {context} />
    {/each}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>Go back</Button>
    <Button class="button button-primary" onclick={makeEvent}>
      <Icon icon={Add} />
      Create
    </Button>
  </ModalFooter>
</Modal>
