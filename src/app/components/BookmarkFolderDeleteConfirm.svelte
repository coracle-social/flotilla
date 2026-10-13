<script lang="ts">
  import Confirm from "@lib/components/Confirm.svelte"
  import {deleteBookmarkFolder} from "@app/features/bookmarks"
  import {clearModals} from "@app/navigation/dialogs"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    address: string
    name: string
  }

  const {address, name}: Props = $props()

  const confirm = async () => {
    const error = await deleteBookmarkFolder(address)

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
