<script lang="ts">
  import FolderMove from "@assets/icons/folder-move.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import BookmarkMove from "@app/components/BookmarkMove.svelte"
  import {removeBookmark} from "@app/bookmarks"
  import type {BookmarkFolder} from "@app/bookmarks"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    folder: BookmarkFolder
    tag: string[]
    onClick: () => void
  }

  const {folder, tag, onClick}: Props = $props()

  const move = () => pushModal(BookmarkMove, {folder, tag})

  const remove = () => {
    removeBookmark(tag[1])
    pushToast({message: "Bookmark removed"})
  }
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  <li>
    <Button onclick={move}>
      <Icon size={4} icon={FolderMove} />
      Move Bookmark
    </Button>
  </li>
  <li>
    <Button class="text-error" onclick={remove}>
      <Icon size={4} icon={TrashBin2} />
      Remove Bookmark
    </Button>
  </li>
</ul>
