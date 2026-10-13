<script lang="ts">
  import Pen from "@assets/icons/pen.svg?dataurl"
  import RemoveFolder from "@assets/icons/remove-folder.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import BookmarkFolderDeleteConfirm from "@app/components/BookmarkFolderDeleteConfirm.svelte"
  import BookmarkFolderEdit from "@app/components/BookmarkFolderEdit.svelte"
  import type {BookmarkFolder} from "@app/features/bookmarks"
  import {pushModal} from "@app/ui/modal"

  type Props = {
    folder: BookmarkFolder
    onClick: () => void
  }

  const {folder, onClick}: Props = $props()

  const rename = () => pushModal(BookmarkFolderEdit, {folder})

  const remove = () =>
    pushModal(BookmarkFolderDeleteConfirm, {identifier: folder.identifier, name: folder.title})
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  <li>
    <Button onclick={rename}>
      <Icon size={4} icon={Pen} />
      Rename Folder
    </Button>
  </li>
  <li>
    <Button class="text-error" onclick={remove}>
      <Icon size={4} icon={RemoveFolder} />
      Delete Folder
    </Button>
  </li>
</ul>
