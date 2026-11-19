<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {Report} from "@welshman/domain"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import {command, writer} from "@app/core/domain"
  import {pushToast} from "@app/navigation/toast"
  import {trackSubmit} from "@app/components/flows/submit"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const back = () => history.back()

  const {loading, submit: confirm} = trackSubmit(
    () => "Failed to send your report.",
    async () => {
      if (!reason) {
        return pushToast({
          theme: "error",
          message: "Please select a reason for your report.",
        })
      }

      const eventWriter = writer(Report)
        .setPubkey(event.pubkey)
        .setEventId(event.id)
        .setReason(reason.toLowerCase())
        .setContent(content)

      const reportCommand = await command(eventWriter)
      const error = await reportCommand.publishToRelays([url]).getFatalError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      history.back()

      pushToast({message: "Your report has been sent!"})
    },
  )

  let reason = $state("")
  let content = $state("")
</script>

<Modal tag="form" onsubmit={preventDefault(confirm)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Report Content</ModalTitle>
      <ModalSubtitle>Flag inappropriate content.</ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        <p>Reason*</p>
      {/snippet}
      {#snippet input()}
        <select class="select input" bind:value={reason}>
          <option disabled selected>Choose a reason</option>
          <option>Nudity</option>
          <option>Malware</option>
          <option>Profanity</option>
          <option>Illegal</option>
          <option>Spam</option>
          <option>Impersonation</option>
          <option>Other</option>
        </select>
      {/snippet}
      {#snippet info()}
        <p>Please select a reason for your report.</p>
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        <p>Details</p>
      {/snippet}
      {#snippet input()}
        <textarea class="textarea input" bind:value={content}></textarea>
      {/snippet}
      {#snippet info()}
        <p>Please provide any additional details relevant to your report.</p>
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={$loading}>
      <Spinner loading={$loading}>Send Report</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
