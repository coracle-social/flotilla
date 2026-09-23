<script lang="ts">
  import {onMount} from "svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {goToHome, goToNote} from "@app/routes"
  import {decodeNotePointer} from "@app/social"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const pointer = decodeNotePointer(params.nevent)

  onMount(() => {
    if (pointer) {
      goToNote(pointer)
    } else {
      goToHome()
    }
  })
</script>

<Spinner />
