<script lang="ts">
  import {page} from "$app/state"
  import type {PinboardReader} from "@welshman/domain"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import TrashBin from "@assets/icons/trash-bin-2.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import {errorMessage} from "@lib/util"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Notice from "@lib/components/Notice.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import PinboardEdit from "@app/components/PinboardEdit.svelte"
  import {user} from "@app/core/app"
  import {deriveSpacePermissions} from "@app/core/management"
  import {deleteLibraryEvent} from "@app/features/pinboards"
  import {shareEvent} from "@app/ui/share"
  import {navigate, pushModal} from "@app/ui/modal"
  import {makeLibraryPath} from "@app/ui/routes"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    url: string
    board: PinboardReader
    onClick: () => void
  }

  const {url, board, onClick}: Props = $props()

  const permissions = deriveSpacePermissions(url)
  const isAuthor = $derived(board.event.pubkey === $user.pubkey)
  const canDelete = $derived(isAuthor || $permissions.deleteContent)

  const showInfo = () => pushModal(EventInfo, {url, event: board.event})

  const share = () => shareEvent(url, "Shelf", board.event)

  const edit = () => pushModal(PinboardEdit, {url, board})

  const deleteBoard = async () => {
    try {
      const error = await deleteLibraryEvent(url, board.event)

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Shelf deleted!"})

        if (page.url.pathname === makeLibraryPath(url, board.address())) {
          navigate(makeLibraryPath(url))
        }
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: errorMessage(e)})
    }
  }

  const confirmDelete = () =>
    pushModal(Confirm, {
      title: "Delete Shelf",
      message: `Delete "${board.title() || "this shelf"}"?`,
      confirm: deleteBoard,
    })

  const explainDelete = () =>
    pushModal(Notice, {
      title: "You can't delete this shelf",
      message: "Only the person who made a shelf, or an admin of this space, can delete it.",
    })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  <li>
    <Button onclick={showInfo}>
      <Icon icon={Code2} />
      Shelf details
    </Button>
  </li>
  <li>
    <Button onclick={share}>
      <Icon icon={ShareCircle} />
      Share to chat
    </Button>
  </li>
  {#if isAuthor}
    <li>
      <Button onclick={edit}>
        <Icon icon={Pen} />
        Edit shelf
      </Button>
    </li>
  {/if}
  <li>
    <Button class="text-error" onclick={canDelete ? confirmDelete : explainDelete}>
      <Icon icon={TrashBin} />
      Delete shelf
    </Button>
  </li>
</ul>
