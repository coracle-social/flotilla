<script lang="ts">
  import {getTag, ManagementMethod} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {pubkey, manageRelay, repository, displayProfileByPubkey} from "@welshman/app"
  import InboxOut from "@assets/icons/inbox-out.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Close from "@assets/icons/close.svg?dataurl"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import {deriveUserIsSpaceAdmin} from "@app/core/state"
  import {publishDelete, canEnforceNip70} from "@app/core/commands"
  import {pushToast} from "@app/util/toast"
  import {pushModal} from "@app/util/modal"

  type Props = {
    url: string
    event: TrustedEvent
    onDelete?: () => void
  }

  const {url, event, onDelete}: Props = $props()

  const shouldProtect = canEnforceNip70(url)
  const userIsAdmin = deriveUserIsSpaceAdmin(url)
  const etag = getTag("e", event.tags)
  const ptag = getTag("p", event.tags)

  const toggleMenu = () => {
    isOpen = !isOpen
  }

  const closeMenu = () => {
    isOpen = false
  }

  const deleteReport = async () => {
    publishDelete({event, relays: [url], protect: await shouldProtect})
    onDelete?.()
  }

  const dismissReport = async () => {
    const {error} = await manageRelay(url, {
      method: ManagementMethod.BanEvent,
      params: [event.id, "Dismissed by admin"],
    })

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "Content has successfully been deleted!"})
      repository.removeEvent(event.id)
      onDelete?.()
    }
  }

  const banContent = () => {
    const [_, id, reason = ""] = etag!

    pushModal(Confirm, {
      title: `Remove Content`,
      message: `Are you sure you want to delete this content from the space?`,
      confirm: async () => {
        const {error} = await manageRelay(url, {
          method: ManagementMethod.BanEvent,
          params: [id, reason],
        })

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Content has successfully been deleted!"})
          repository.removeEvent(event.id)
          repository.removeEvent(id)
          history.back()
          setTimeout(() => onDelete?.())
        }
      },
    })
  }

  const banMember = () => {
    const [_, pubkey, reason = ""] = ptag!

    pushModal(Confirm, {
      title: "Ban User",
      message: `Are you sure you want to ban @${displayProfileByPubkey(pubkey)} from the space?`,
      confirm: async () => {
        const {error} = await manageRelay(url, {
          method: ManagementMethod.BanPubkey,
          params: [pubkey, reason],
        })

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "User has successfully been banned!"})
          repository.removeEvent(event.id)
          history.back()
          setTimeout(() => onDelete?.())
        }
      },
    })
  }

  let isOpen = $state(false)
</script>

<div class="relative">
  <Button class="btn btn-circle btn-ghost btn-sm" onclick={toggleMenu}>
    <Icon icon={MenuDots} />
  </Button>
  {#if isOpen}
    <Popover hideOnClick onClose={closeMenu}>
      <ul
        transition:fly
        class="menu absolute right-0 z-popover mt-2 w-48 gap-1 rounded-box bg-base-100 p-2 shadow-md">
        {#if event.pubkey === $pubkey}
          <li>
            <Button onclick={deleteReport}>
              <Icon icon={Close} />
              Delete Report
            </Button>
          </li>
        {/if}
        {#if $userIsAdmin}
          <li>
            <Button onclick={dismissReport}>
              <Icon icon={InboxOut} />
              Dismiss Report
            </Button>
          </li>
          {#if etag}
            <li>
              <Button class="text-error" onclick={banContent}>
                <Icon icon={TrashBin2} />
                Remove Content
              </Button>
            </li>
          {/if}
          {#if ptag}
            <li>
              <Button class="text-error" onclick={banMember}>
                <Icon icon={MinusCircle} />
                Ban User
              </Button>
            </li>
          {/if}
        {/if}
      </ul>
    </Popover>
  {/if}
</div>
