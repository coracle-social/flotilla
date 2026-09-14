<script lang="ts">
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import CalendarEventForm from "@app/components/CalendarEventForm.svelte"
  import {makeDayRange} from "@app/calendar"

  type Props = {
    url: string
    h?: string
    shareToChat?: boolean
    date?: Date
  }

  const {url, h, shareToChat = false, date}: Props = $props()

  // Creating from a day in the grid starts the event on that day
  const range = date ? makeDayRange(date) : undefined
</script>

<CalendarEventForm {url} {h} {shareToChat} defaultStart={range?.start} defaultEnd={range?.end}>
  {#snippet header()}
    <ModalHeader>
      <ModalTitle>Create an Event</ModalTitle>
      <ModalSubtitle>Invite other room members to events online or in real life.</ModalSubtitle>
    </ModalHeader>
  {/snippet}
</CalendarEventForm>
