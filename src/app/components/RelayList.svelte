<script lang="ts">
  import type {Readable} from "svelte/store"
  import {SvelteSet} from "svelte/reactivity"
  import type {Thunk} from "@welshman/app"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import DangerTriangle from "@assets/icons/danger-triangle.svg?dataurl"
  import {errorMessage} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import RelayAdd from "@app/components/RelayAdd.svelte"
  import RelayItem from "@app/components/RelayItem.svelte"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    title: string
    subtitle: string
    relays: Readable<string[]>
    addRelay: (url: string) => Promise<Thunk>
    removeRelay: (url: string) => Promise<Thunk>
    matchRelay?: (url: string) => boolean
  }

  const {title, subtitle, relays, addRelay, removeRelay, matchRelay}: Props = $props()

  const back = () => history.back()

  const add = () => pushModal(RelayAdd, {relays, addRelay, matchRelay})

  const remove = async (url: string) => {
    loading.add(url)

    try {
      const thunk = await removeRelay(url)
      const error = await thunk.waitForError()

      if (error) {
        pushToast({
          theme: "error",
          message: `Failed to remove relay: ${errorMessage(error)}`,
        })
      }
    } finally {
      loading.delete(url)
    }
  }

  const loading = new SvelteSet<string>()
</script>

<Modal>
  <ModalBody>
    <ModalTitle class="text-xl">{title}</ModalTitle>
    <p class="text-sm">{subtitle}</p>
    {#each $relays.toSorted() as url (url)}
      <RelayItem {url}>
        <Button
          class="button button-neutral button-sm"
          disabled={loading.has(url)}
          onclick={() => remove(url)}>
          {#if loading.has(url)}
            <Spinner size="sm" />
          {:else}
            <Icon icon={CloseCircle} />
          {/if}
          Remove
        </Button>
      </RelayItem>
    {:else}
      <p class="text-center py-12 flex justify-center items-center gap-2">
        <Icon icon={DangerTriangle} />
        No relay selections found.
      </p>
    {/each}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" onclick={add}>
      Add Relays
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
