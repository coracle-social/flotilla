<script lang="ts">
  import cx from "classnames"
  import type {ComponentProps} from "svelte"
  import {MESSAGE, getIdOrAddress} from "@welshman/util"
  import {isMobile} from "@lib/html"
  import Link from "@lib/components/Link.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import {makeContentPath} from "@app/ui/routes"

  const props: ComponentProps<typeof NoteContent> = $props()
  const path = makeContentPath(props.url!, props.event.kind, getIdOrAddress(props.event))

  const minLength = 5000
  const maxLength = 5500
  const className = cx("text-sm block", {"card card-sm shadow-none": props.event.kind !== MESSAGE})
</script>

{#if path && !isMobile}
  <Link href={path} class={className}>
    <NoteContent {...props} {minLength} {maxLength} />
  </Link>
{:else}
  <div class={className}>
    <NoteContent {...props} {minLength} {maxLength} />
  </div>
{/if}
