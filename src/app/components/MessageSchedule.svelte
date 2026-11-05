<script lang="ts">
  import {writable} from "svelte/store"
  import {HOUR, now} from "@welshman/lib"
  import type {Maybe, MaybeAsync} from "@welshman/lib"
  import type {EventContent} from "@welshman/util"
  import {isMobile} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import DateTimeInput from "@lib/components/DateTimeInput.svelte"
  import EditorContent from "@app/features/editor/EditorContent.svelte"
  import {makeEditor} from "@app/features/editor"
  import {ScheduleError} from "@app/features/scheduling"
  import {pushToast} from "@app/features/toast"

  type Props = {
    url: string
    content?: string | object
    onSchedule: (values: EventContent & {scheduleAt: number}) => MaybeAsync<void>
  }

  const {url, content, onSchedule}: Props = $props()

  const uploading = writable(false)

  const empty = writable(true)

  const back = () => history.back()

  const submit = async () => {
    if (ready && scheduleAt) {
      const ed = await editor

      loading = true

      try {
        await onSchedule({
          content: ed.getText({blockSeparator: "\n"}).trim(),
          tags: ed.storage.nostr.getEditorTags(),
          scheduleAt,
        })

        back()
        pushToast({
          message: `Your message is scheduled for ${new Date(scheduleAt * 1000).toLocaleString([], {dateStyle: "medium", timeStyle: "short"})}.`,
        })
      } catch (e) {
        if (e instanceof ScheduleError) {
          pushToast({theme: "error", message: e.message})
        } else {
          console.error(e)
          pushToast({theme: "error", message: "Failed to schedule your message."})
        }
      } finally {
        loading = false
      }
    }
  }

  let loading = $state(false)
  let scheduleAt: Maybe<number> = $state(Math.ceil(now() / HOUR + 1) * HOUR)

  const ready = $derived(scheduleAt && scheduleAt > now() && !$empty && !$uploading && !loading)

  const editor = makeEditor({url, content, empty, submit, uploading, placeholder: "Message"})
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Schedule a Message</ModalTitle>
    </ModalHeader>
    <div class="note-editor overflow-hidden">
      <EditorContent autofocus={!isMobile} {editor} />
    </div>
    <DateTimeInput bind:value={scheduleAt} disablePast />
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" onclick={submit} disabled={!ready}>
      <Spinner {loading}>Schedule</Spinner>
    </Button>
  </ModalFooter>
</Modal>
