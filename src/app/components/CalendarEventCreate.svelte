<script lang="ts">
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import CalendarEventForm from "@app/components/CalendarEventForm.svelte"

  type Props = {
    url: string
    room?: string
  }

  const {url, room}: Props = $props()
</script>

<CalendarEventForm {url} {room}>
  {#snippet header()}
    <ModalHeader>
      {#snippet title()}
        <div>Create an Event</div>
      {/snippet}
      {#snippet info()}
        <div>Invite other group members to events online or in real life.</div>
      {/snippet}
    </ModalHeader>
  {/snippet}
</CalendarEventForm>
