<script lang="ts">
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import CalendarEventForm from "@app/components/CalendarEventForm.svelte"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()
</script>

<CalendarEventForm {url} {h}>
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
