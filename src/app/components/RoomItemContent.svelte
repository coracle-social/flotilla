<script lang="ts">
  import cx from "classnames"
  import type {ComponentProps} from "svelte"
  import {removeUndefined} from "@welshman/lib"
  import {EventRef, MESSAGE, getIdOrAddress} from "@welshman/util"
  import {Message} from "@welshman/domain"
  import {parse} from "@welshman/content"
  import {isMobile} from "@lib/html"
  import Link from "@lib/components/Link.svelte"
  import ContentQuote from "@app/components/ContentQuote.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import {reader} from "@app/core/domain"
  import {isQuote} from "@app/features/quotes"
  import {makeContentPath} from "@app/navigation/pages"

  const props: ComponentProps<typeof NoteContent> = $props()
  const path = makeContentPath(props.url!, props.event.kind, getIdOrAddress(props.event))

  const minLength = 5000
  const maxLength = 5500
  const className = cx("text-sm block", {"card card-sm shadow-none": props.event.kind !== MESSAGE})

  const parent = props.event.kind === MESSAGE ? reader(Message)(props.event).parent() : undefined
  const referenced = parse(props.event)
    .filter(isQuote)
    .flatMap(parsed => EventRef.fromPointer(parsed.value).getIdAndAddress())
  // A reply sent before the parent moved to the q tag alone also references it in the content.
  const parentRef =
    parent && !referenced.includes(parent.value)
      ? EventRef.fromString(parent.value, removeUndefined([parent.relay]))
      : undefined
</script>

{#if path && !isMobile}
  <Link href={path} class={className}>
    {#if parentRef}
      <ContentQuote url={props.url} ref={parentRef} event={props.event} />
    {/if}
    <NoteContent {...props} {minLength} {maxLength} />
  </Link>
{:else}
  <div class={className}>
    {#if parentRef}
      <ContentQuote url={props.url} ref={parentRef} event={props.event} />
    {/if}
    <NoteContent {...props} {minLength} {maxLength} />
  </div>
{/if}
