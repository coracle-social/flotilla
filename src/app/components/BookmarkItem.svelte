<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import BookmarkItemMenu from "@app/components/BookmarkItemMenu.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import type {BookmarkFolder} from "@app/bookmarks"
  import {goToEvent} from "@app/routes"

  type Props = {
    folder: BookmarkFolder
    tag: string[]
    event?: TrustedEvent
  }

  const {folder, tag, event}: Props = $props()

  const open = () => {
    if (event) {
      goToEvent(event)
    }
  }
</script>

<div class="card card-sm flex h-full min-w-0 items-center gap-2">
  <div class="min-w-0 flex-1">
    {#if event}
      <Button onclick={open} class="flex w-full min-w-0 flex-col items-start gap-0.5 text-left">
        <strong class="truncate min-w-0 max-w-full text-sm">
          <ProfileName pubkey={event.pubkey} url={tag[2]} />
        </strong>
        <span class="w-full min-w-0">
          <NoteContentMinimal {event} url={tag[2]} singleLine />
        </span>
      </Button>
    {:else if tag[0] === "t"}
      <strong>#{tag[1]}</strong>
    {:else if tag[0] === "r"}
      <Link external href={tag[1]} class="block truncate min-w-0 text-sm">{tag[1]}</Link>
    {:else}
      <span class="text-sm text-content-muted">Still looking for this one...</span>
    {/if}
  </div>
  <MenuButton
    component={BookmarkItemMenu}
    componentProps={{folder, tag}}
    aria-label="Bookmark actions" />
</div>
