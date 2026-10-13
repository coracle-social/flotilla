<script lang="ts">
  import Confirm from "@lib/components/Confirm.svelte"
  import {deleteBookmarkFolder} from "@app/features/bookmarks"
  import {clearModals} from "@app/ui/modal"
  import {pushToast} from "@app/ui/toast"

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
