<script lang="ts">
  import Confirm from "@lib/components/Confirm.svelte"
  import {deleteBookmarkFolder} from "@app/bookmarks"
  import {clearModals} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    identifier: string
    name: string
  }

  const {identifier, name}: Props = $props()

  const confirm = async () => {
    const error = await deleteBookmarkFolder(identifier)

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      clearModals()
    }
  }
</script>

<Confirm
  {confirm}
  title="Delete Folder"
  subtitle={name}
  message="The bookmarks in this folder go with it. Move anything you want to keep first." />
