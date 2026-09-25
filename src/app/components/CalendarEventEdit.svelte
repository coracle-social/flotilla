<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {TimeEvent} from "@welshman/domain"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import {reader} from "@app/core"
  import CalendarEventForm from "@app/components/CalendarEventForm.svelte"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const timeEvent = $derived(reader(TimeEvent)(event))

  const initialValues = $derived(
    timeEvent && {
      d: timeEvent.identifier() ?? "",
      title: timeEvent.title() ?? "",
      location: timeEvent.location() ?? "",
      start: timeEvent.start(),
      end: timeEvent.end(),
      content: timeEvent.content(),
    },
  )
</script>

{#if initialValues}
  <CalendarEventForm {url} h={timeEvent.room()} {initialValues}>
    {#snippet header()}
      <ModalHeader>
        <ModalTitle>Edit this Event</ModalTitle>
        <ModalSubtitle>Invite other room members to events online or in real life.</ModalSubtitle>
      </ModalHeader>
    {/snippet}
  </CalendarEventForm>
{/if}
