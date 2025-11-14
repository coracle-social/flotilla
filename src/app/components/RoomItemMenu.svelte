<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {ManagementMethod} from "@welshman/util"
  import {pubkey, manageRelay, repository} from "@welshman/app"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import EventReport from "@app/components/EventReport.svelte"
  import EventDeleteConfirm from "@app/components/EventDeleteConfirm.svelte"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {deriveUserIsSpaceAdmin} from "@app/core/state"

  type Props = {
    url: string
    event: TrustedEvent
    onClick: () => void
  }

  const {url, event, onClick}: Props = $props()

  const userIsAdmin = deriveUserIsSpaceAdmin(url)

  const report = () => {
    onClick()
    pushModal(EventReport, {url, event})
  }

  const showInfo = () => {
    onClick()
    pushModal(EventInfo, {url, event})
  }

  const showDelete = () => {
    onClick()
    pushModal(EventDeleteConfirm, {url, event})
  }

  const showAdminDelete = () =>
    pushModal(Confirm, {
      title: `Delete Message`,
      message: `Are you sure you want to delete this message from the space?`,
      confirm: async () => {
        const {error} = await manageRelay(url, {
          method: ManagementMethod.BanEvent,
          params: [event.id],
        })

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Event has successfully been deleted!"})
          repository.removeEvent(event.id)
          history.back()
        }
      },
    })
</script>

<ul class="menu whitespace-nowrap rounded-box bg-base-100 p-2 shadow-md">
  <li>
    <Button onclick={showInfo}>
      <Icon size={4} icon={Code2} />
      Show JSON
    </Button>
  </li>
  {#if event.pubkey === $pubkey}
    <li>
      <Button onclick={showDelete} class="text-error">
        <Icon size={4} icon={TrashBin2} />
        Delete Message
      </Button>
    </li>
  {:else}
    <li>
      <Button class="text-error" onclick={report}>
        <Icon size={4} icon={Danger} />
        Report Content
      </Button>
    </li>
    {#if $userIsAdmin}
      <li>
        <Button class="text-error" onclick={showAdminDelete}>
          <Icon size={4} icon={TrashBin2} />
          Delete Message
        </Button>
      </li>
    {/if}
  {/if}
</ul>
