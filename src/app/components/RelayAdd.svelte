<script lang="ts">
  import {onMount} from "svelte"
  import {SvelteSet} from "svelte/reactivity"
  import type {Readable} from "svelte/store"
  import {tryCatch, uniq} from "@welshman/lib"
  import {isShareableRelayUrl, isIPAddress, normalizeRelayUrl} from "@welshman/util"
  import type {Thunk} from "@welshman/app"
  import {Relays} from "@welshman/app"
  import {createScroller} from "@lib/html"
  import {errorMessage} from "@lib/util"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelayItem from "@app/components/RelayItem.svelte"
  import {pushToast} from "@app/toast"
  import {app, blockedRelayLists, relayLists, user} from "@app/core"

  interface Props {
    relays: Readable<string[]>
    addRelay: (url: string) => Promise<Thunk>
    matchRelay?: (url: string) => boolean
  }

  const {relays, addRelay, matchRelay}: Props = $props()

  const back = () => history.back()

  const customUrl = $derived(tryCatch(() => normalizeRelayUrl(term)))

  const add = async (url: string) => {
    loading.add(url)

    try {
      const thunk = await addRelay(url)
      const error = await thunk.waitForError()

      if (error) {
        pushToast({
          theme: "error",
          message: `Failed to add relay: ${errorMessage(error)}`,
        })
      }
    } finally {
      loading.delete(url)
    }
  }

  let term = $state("")
  let limit = $state(20)
  let element: Element | undefined = $state()

  const loading = new SvelteSet<string>()
  const relaySearch = $app.use(Relays).relaySearch
  const blockedRelayUrls = $blockedRelayLists.urls($user.pubkey).$

  const searchResults = $derived(
    $relaySearch
      .searchValues(term)
      .filter((url: string) => {
        if (matchRelay?.(url) === false) return false
        if ($relays.includes(url)) return false
        if (isIPAddress(url)) return false
        if ($blockedRelayUrls.includes(url)) return false

        return true
      })
      .slice(0, limit),
  )

  // Suggestions come from relay search, which only knows about relays whose NIP-11
  // document has been fetched — so seed it from everyone's relay lists.
  onMount(() => {
    const urls = uniq($relayLists.all.get().flatMap(list => list.urls()))

    for (const url of urls.filter(isShareableRelayUrl)) {
      $app.use(Relays).load(url)
    }

    const scroller = createScroller({
      element: element!,
      delay: 300,
      onScroll: () => {
        limit += 20
      },
    })

    return () => {
      scroller.stop()
    }
  })
</script>

<Modal label="Add relays">
  <ModalBody>
    <label class="input input-group flex w-full items-center gap-2">
      <Icon icon={Magnifier} />
      <input bind:value={term} class="grow" type="text" placeholder="Search for relays..." />
    </label>
    <div class="flex flex-col -m-6 mt-0 h-[50vh] gap-2 overflow-auto p-6 pt-2" bind:this={element}>
      {#if customUrl && isShareableRelayUrl(customUrl) && !$relays.includes(customUrl)}
        <RelayItem url={term}>
          <Button
            class="button button-outline button-sm flex items-center"
            disabled={loading.has(customUrl)}
            onclick={() => add(customUrl)}>
            {#if loading.has(customUrl)}
              <Spinner size="sm" />
            {:else}
              <Icon icon={AddCircle} />
            {/if}
            Add Relay
          </Button>
        </RelayItem>
      {/if}
      {#each searchResults as url (url)}
        <RelayItem {url}>
          <Button
            class="button button-outline button-sm flex items-center"
            disabled={loading.has(url)}
            onclick={() => add(url)}>
            {#if loading.has(url)}
              <Spinner size="sm" />
            {:else}
              <Icon icon={AddCircle} />
            {/if}
            Add Relay
          </Button>
        </RelayItem>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-primary grow" onclick={back}>Done</Button>
  </ModalFooter>
</Modal>
