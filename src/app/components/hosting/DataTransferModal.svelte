<script lang="ts">
  import type {Maybe} from "@welshman/lib"
  import {randomId} from "@welshman/lib"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Download from "@assets/icons/download.svg?dataurl"
  import Upload from "@assets/icons/upload.svg?dataurl"
  import {downloadText} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {pushToast} from "@app/toast"
  import {
    exportRelayData,
    importRelayData,
    HostingError,
    type HostedRelay,
    type ImportResult,
  } from "@app/hosting"

  type Props = {
    relay: HostedRelay
  }

  const {relay}: Props = $props()

  const inputId = randomId()

  const relayLabel = relay.info_name || relay.subdomain

  const back = () => history.back()

  const onFileChange = (event: Event) => {
    file = (event.target as HTMLInputElement).files?.[0]
    result = undefined
  }

  const download = async () => {
    exporting = true

    try {
      await downloadText(`${relay.subdomain}.jsonl`, await exportRelayData(relay.id))
    } catch (e) {
      pushToast({
        theme: "error",
        message: e instanceof HostingError ? e.message : "Failed to export relay data.",
      })
    } finally {
      exporting = false
    }
  }

  const upload = async () => {
    if (file) {
      importing = true

      try {
        result = await importRelayData(relay.id, file)
      } catch (e) {
        pushToast({
          theme: "error",
          message: e instanceof HostingError ? e.message : "Failed to import relay data.",
        })
      } finally {
        importing = false
      }
    }
  }

  let exporting = $state(false)
  let importing = $state(false)
  let file: Maybe<File> = $state()
  let result: Maybe<ImportResult> = $state()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Relay data</ModalTitle>
      <ModalSubtitle>
        Everything {relayLabel} holds, as one event per line. Uploaded media is not included.
      </ModalSubtitle>
    </ModalHeader>

    <div class="flex flex-col items-start gap-2">
      <h3 class="text-sm font-semibold uppercase tracking-wider text-content-muted">Export</h3>
      <p class="text-sm text-content-muted">
        Download a copy of every event on the relay, for a backup or a move to another host.
      </p>
      <Button class="button button-primary" onclick={download} disabled={exporting}>
        {#if !exporting}
          <Icon icon={Download} size={4} />
        {/if}
        <Spinner loading={exporting}>Download events</Spinner>
      </Button>
    </div>

    <Divider />

    <div class="flex flex-col items-start gap-2">
      <h3 class="text-sm font-semibold uppercase tracking-wider text-content-muted">Import</h3>
      <p class="text-sm text-content-muted">
        Add the events in a file to the relay. Each one carries its own signature, so a tampered or
        unsigned line is skipped and reported, and importing the same file twice changes nothing.
      </p>
      <input
        id={inputId}
        type="file"
        accept=".jsonl,.ndjson,.json,application/x-ndjson,application/json"
        onchange={onFileChange}
        class="hidden" />
      <div class="flex flex-wrap items-center gap-2">
        <label for={inputId} class="button button-neutral cursor-pointer">
          <Icon icon={Upload} size={4} />
          {file ? "Choose another file" : "Choose a file"}
        </label>
        {#if file}
          <span class="min-w-0 break-all text-sm text-content-muted">{file.name}</span>
        {/if}
      </div>
      <Button class="button button-primary" onclick={upload} disabled={importing || !file}>
        <Spinner loading={importing}>Import events</Spinner>
      </Button>
    </div>

    {#if result}
      <div class="flex flex-col gap-2 rounded-2xl border border-line bg-surface-less p-4">
        <p class="text-sm">
          Imported {result.imported}
          {result.imported === 1 ? "event" : "events"}{result.invalid > 0
            ? `, skipped ${result.invalid}`
            : ""}.
        </p>
        {#each result.problems?.slice(0, 5) || [] as problem (problem.line)}
          <p class="break-all font-mono text-xs text-content-muted">
            {problem.line ? `line ${problem.line}: ` : ""}{problem.message}
          </p>
        {/each}
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
  </ModalFooter>
</Modal>
