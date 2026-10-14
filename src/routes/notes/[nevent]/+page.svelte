<script lang="ts">
  import {onMount} from "svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {goToHome} from "@app/navigation/history"
  import {goToNote} from "@app/navigation/overlays"
  import * as pages from "@app/navigation/pages"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {ref} = pages.note.decode(params)

  onMount(() => {
    if (ref) {
      goToNote(ref)
    } else {
      goToHome()
    }
  })
</script>

<Spinner />
