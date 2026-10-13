<script lang="ts">
  import {onDestroy} from "svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import {popModal} from "@app/ui/modal"
  import type {ScreenShareSource} from "@app/features/screenShare"

  type Props = {
    sources: ScreenShareSource[]
    onSelect: (source?: ScreenShareSource) => void
  }

  const {sources, onSelect}: Props = $props()

  const screens = sources.filter(source => source.type === "screen")
  const windows = sources.filter(source => source.type === "window")

  const onSourceClick = (source: ScreenShareSource) => () => {
    onSelect(source)
    popModal()
  }

  // Closing the modal is the user cancelling. Resolving a second time is a no-op.
  onDestroy(() => onSelect(undefined))
</script>

{#snippet group(title: string, groupSources: ScreenShareSource[])}
  {#if groupSources.length > 0}
    <div class="@container flex flex-col gap-2">
      <strong class="text-sm opacity-75">{title}</strong>
      <div class="grid grid-cols-2 gap-3 @md:grid-cols-3">
        {#each groupSources as source (source.id)}
          <Button
            class="card card-interactive flex flex-col gap-2 p-2 text-left"
            onclick={onSourceClick(source)}>
            <img
              src={source.thumbnail}
              alt=""
              class="aspect-video w-full rounded-xl bg-black object-contain" />
            <span class="truncate text-sm">{source.name}</span>
          </Button>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

<Modal label="Share your screen">
  <ModalHeader>
    <ModalTitle>Share your screen</ModalTitle>
    <ModalSubtitle>Everyone in the call will see what you pick.</ModalSubtitle>
  </ModalHeader>
  <ModalBody>
    {#if sources.length === 0}
      <p>No screens or windows are available to share.</p>
    {:else}
      <div class="flex flex-col gap-4">
        {@render group("Screens", screens)}
        {@render group("Windows", windows)}
      </div>
    {/if}
  </ModalBody>
</Modal>
