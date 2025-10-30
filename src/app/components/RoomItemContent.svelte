<script lang="ts">
  import cx from "classnames"
  import type {ComponentProps} from "svelte"
  import {MESSAGE} from "@welshman/util"
  import {isMobile} from "@lib/html"
  import Link from "@lib/components/Link.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import {getRoomItemPath} from "@app/util/routes"

  const props: ComponentProps<typeof NoteContent> = $props()

  const path = getRoomItemPath(props.url!, props.event)
</script>

<div class={cx("text-sm", {"card2 card2-sm bg-alt": props.event.kind !== MESSAGE})}>
  {#if path && !isMobile}
    <Link href={path}>
      <NoteContent {...props} />
    </Link>
  {:else}
    <NoteContent {...props} />
  {/if}
</div>
