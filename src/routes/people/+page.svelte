<script lang="ts">
  import {onMount} from "svelte"
  import {debounce} from "throttle-debounce"
  import {createScroller, isMobile} from "@lib/html"
  import {profileSearch} from "@welshman/app"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import ContentSearch from "@lib/components/ContentSearch.svelte"
  import PeopleItem from "@app/components/PeopleItem.svelte"
  import {bootstrapPubkeys} from "@app/core/state"

  let term = $state("")
  let limit = $state(10)
  let pubkeys = $state($bootstrapPubkeys)
  let element: Element | undefined = $state()

  const search = debounce(200, (term: string) => {
    if (term) {
      pubkeys = $profileSearch.searchValues(term)
    } else {
      pubkeys = $bootstrapPubkeys
    }
  })

  $effect(() => search(term))

  onMount(() => {
    const scroller = createScroller({
      element: element!,
      onScroll: () => {
        limit += 10
      },
    })

    return () => scroller.stop()
  })
</script>

<Page class="cw-full">
  <ContentSearch>
    {#snippet input()}
      <label class="row-2 input input-bordered">
        <Icon icon={Magnifier} />
        <!-- svelte-ignore a11y_autofocus -->
        <input
          autofocus={!isMobile}
          bind:value={term}
          class="grow"
          type="text"
          placeholder="Search for people..." />
      </label>
    {/snippet}
    {#snippet content()}
      <div class="col-2 h-full" bind:this={element}>
        {#each pubkeys.slice(0, limit) as pubkey (pubkey)}
          <PeopleItem {pubkey} />
        {/each}
      </div>
    {/snippet}
  </ContentSearch>
</Page>
