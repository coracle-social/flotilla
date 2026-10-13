<script lang="ts">
  import FolderMove from "@assets/icons/folder-move.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import BookmarkMove from "@app/components/BookmarkMove.svelte"
  import {removeBookmark} from "@app/features/bookmarks"
  import type {BookmarkFolder} from "@app/features/bookmarks"
  import {pushModal} from "@app/ui/modal"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    folder: BookmarkFolder
    tag: string[]
    onClick: () => void
  }

  const {folder, tag, onClick}: Props = $props()

  const move = () => pushModal(BookmarkMove, {folder, tag})

  const remove = async () => {
    const error = await removeBookmark(tag[1])

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "Bookmark removed"})
    }
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
