<script lang="ts">
  import {onMount} from "svelte"
  import {matchTag, tagSpec} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import InboxOut from "@assets/icons/inbox-out.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Close from "@assets/icons/close.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import {app, deletes, profiles, relayManagement, relays, user} from "@app/core"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {pushToast} from "@app/toast"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    event: TrustedEvent
    onResolved?: () => void
    onClick: () => void
  }

  const {url, event, onResolved, onClick}: Props = $props()

  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canBanEvent = $derived($supportedMethods.includes("banevent"))
  const canBanPubkey = $derived($supportedMethods.includes("banpubkey"))
  const etag = matchTag(tagSpec("e"), event.tags)
  const ptag = matchTag(tagSpec("p"), event.tags)

  const deleteReport = async () => {
    const protect = await $relays.hasNip(url, 70)
    const command = await $deletes.deleteEvent(event, w => w.setProtected(protect))

    command.publishToRelays([url])
    onResolved?.()
  }

  const dismissReport = async () => {
    const {error} = await $relayManagement.forUrl(url).banEvent(event.id, "Dismissed by admin")

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "Report has successfully been dismissed!"})
      $app.repository.removeEvent(event.id)
      onResolved?.()
    }
  }

  const banContent = () => {
    const [_, id, reason = ""] = etag!

    pushModal(Confirm, {
      title: `Remove Content`,
      message: `Are you sure you want to delete this content from the space?`,
      confirm: async () => {
        const {error} = await $relayManagement.forUrl(url).banEvent(id, reason)

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Content has successfully been deleted!"})
          $app.repository.removeEvent(event.id)
          $app.repository.removeEvent(id)
          history.back()
          setTimeout(() => onResolved?.())
        }
      },
    })
  }

  const banMember = () => {
    const [_, reported, reason = ""] = ptag!

    pushModal(Confirm, {
      title: "Ban User",
      message: `Are you sure you want to ban @${$profiles.display(reported, [url]).get()} from the space?`,
      confirm: async () => {
        const {error} = await $relayManagement.forUrl(url).banPubkey(reported, reason)

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "User has successfully been banned!"})
          $app.repository.removeEvent(event.id)
          history.back()
          setTimeout(() => onResolved?.())
        }
      },
    })
  }

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  {#if event.pubkey === $user.pubkey}
    <li>
      <Button onclick={deleteReport}>
        <Icon icon={Close} />
        Delete Report
      </Button>
    </li>
  {/if}
  {#if canBanEvent}
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
  {/if}
  {#if ptag && canBanPubkey}
    <li>
      <Button class="text-error" onclick={banMember}>
        <Icon icon={MinusCircle} />
        Ban User
      </Button>
    </li>
  {/if}
</ul>
