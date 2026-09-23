<script lang="ts">
  import {onMount} from "svelte"
  import NotePage from "@app/components/NotePage.svelte"
  import {navigate} from "@app/modal"
  import {decodeNotePointer} from "@app/social"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const pointer = decodeNotePointer(params.nevent)

  onMount(() => {
    if (!pointer) {
      navigate("/", {replaceState: true})
    }
  })
</script>

{#if pointer}
  <NotePage {pointer} />
{/if}
