<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import Confirm from "@lib/components/Confirm.svelte"
  import {app, relayManagement, rooms} from "@app/core"
  import {AdminDelete, deriveUserAdminDelete} from "@app/rooms"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    noun: string
    event: TrustedEvent
  }

  const {url, noun, event}: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags) ?? ""
  const adminDelete = deriveUserAdminDelete(url, event)
  const scope = $derived($adminDelete === AdminDelete.Room ? "room" : "space")

  const remove = async () => {
    if ($adminDelete === AdminDelete.Room) {
      const command = await $rooms.deleteEvent(url, {h}, event.id)

      return command.publish().waitForError()
    }

    const {error} = await $relayManagement.forUrl(url).banEvent(event.id)

    return error
  }

  const confirm = async () => {
    const error = await remove()

    if (error) {
      return pushToast({theme: "error", message: error})
    }

    pushToast({message: "Event has successfully been deleted!"})
    $app.repository.removeEvent(event.id)
    history.back()
  }
</script>

<Confirm
  {confirm}
  title="Delete {noun}"
  message="Are you sure you want to delete this {noun.toLowerCase()} from the {scope}?" />
