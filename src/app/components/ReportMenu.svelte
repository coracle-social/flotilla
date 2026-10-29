<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {Report} from "@welshman/domain"
  import InboxOut from "@assets/icons/inbox-out.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Close from "@assets/icons/close.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import {app} from "@app/core/app"
  import {user} from "@app/core/user"
  import {deletes, profiles, relayManagement, relays} from "@app/core/plugins"
  import {reader} from "@app/core/domain"
  import {deriveSpacePermissions} from "@app/features/spaces/management"
  import {pushToast} from "@app/features/toast"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    url: string
    event: TrustedEvent
    onResolved?: () => void
    onClick: () => void
  }

  const {url, event, onResolved, onClick}: Props = $props()

  const permissions = deriveSpacePermissions(url)
  const report = reader(Report)(event)
  const reportedId = report.eventId()
  const reportedPubkey = report.pubkey()
  const reason = report.reason() ?? ""

  const deleteReport = async () => {
    const relay = await $relays.load(url)
    const command = await $deletes.deleteEvent(event, w => w.setProtected(relay?.hasNip(70)))

    command.publishToRelays([url])
    onResolved?.()
  }

  const dismissReport = async () => {
    const {error} = await $relayManagement.forUrl(url).banEvent(event.id, "Dismissed by admin")

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "Report has successfully been dismissed!"})
      await $app.repository.removeEvent(event.id)
      onResolved?.()
    }
  }

  const banContent = () => {
    pushModal(Confirm, {
      title: `Remove Content`,
      message: `Are you sure you want to delete this content from the space?`,
      confirm: async () => {
        const {error} = await $relayManagement.forUrl(url).banEvent(reportedId!, reason)

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Content has successfully been deleted!"})
          await $app.repository.removeEvent(event.id)
          await $app.repository.removeEvent(reportedId!)
          history.back()
          setTimeout(() => onResolved?.())
        }
      },
    })
  }

  const banMember = () => {
    pushModal(Confirm, {
      title: "Ban User",
      message: `Are you sure you want to ban @${$profiles.display(reportedPubkey!, [url]).get()} from the space?`,
      confirm: async () => {
        const {error} = await $relayManagement.forUrl(url).banPubkey(reportedPubkey!, reason)

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "User has successfully been banned!"})
          await $app.repository.removeEvent(event.id)
          history.back()
          setTimeout(() => onResolved?.())
        }
      },
    })
  }
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  {#if event.pubkey === $user.pubkey}
    <li>
      <Button onclick={deleteReport}>
        <Icon icon={Close} />
        Delete Report
      </Button>
    </li>
  {/if}
  {#if $permissions.deleteContent}
    <li>
      <Button onclick={dismissReport}>
        <Icon icon={InboxOut} />
        Dismiss Report
      </Button>
    </li>
    {#if reportedId}
      <li>
        <Button class="text-error" onclick={banContent}>
          <Icon icon={TrashBin2} />
          Remove Content
        </Button>
      </li>
    {/if}
  {/if}
  {#if reportedPubkey && $permissions.ban}
    <li>
      <Button class="text-error" onclick={banMember}>
        <Icon icon={MinusCircle} />
        Ban User
      </Button>
    </li>
  {/if}
</ul>
