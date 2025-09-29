<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {getTagValue} from "@welshman/util"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import CalendarEventForm from "@app/components/CalendarEventForm.svelte"
  import ThreadForm, {type Values} from "@app/components/ThreadForm.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const back = () => history.back()

  const {url, event}: Props = $props()

  const initialValues = {
    d: getTagValue("d", event.tags)!,
    title: getTagValue("title", event.tags)!,
    content: event.content,
  }
</script>

<ThreadForm url={url} initialValues={initialValues}>
  {#snippet header()}
  <ModalHeader>
    {#snippet title()}
      <div>Edit Thread</div>
    {/snippet}
  </ModalHeader>
    {/snippet}
  {#snippet footer()}
    <div class="mt-4 flex flex-row items-center justify-between gap-4">
      <Button class="btn btn-neutral" onclick={back}>Discard Changes</Button>
      <Button type="submit" class="btn btn-primary">Edit Thread</Button>
    </div>
  {/snippet}
</ThreadForm>