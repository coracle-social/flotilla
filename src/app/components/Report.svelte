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
  import {command, writer} from "@app/core"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const back = () => history.back()

  const confirm = async () => {
    if (!reason) {
      return pushToast({
        theme: "error",
        message: "Please select a reason for your report.",
      })
    }

    loading = true

    try {
      const eventWriter = writer(Report)
        .setPubkey(event.pubkey)
        .setEventId(event.id)
        .setReason(reason.toLowerCase())
        .setContent(content)

      const reportCommand = await command(eventWriter)
      const error = await reportCommand.publishToRelays([url]).waitForError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      history.back()

      pushToast({message: "Your report has been sent!"})
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to send your report."})
    } finally {
      loading = false
    }
  }

  let reason = $state("")
  let content = $state("")
  let loading = $state(false)
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
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Send Report</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
