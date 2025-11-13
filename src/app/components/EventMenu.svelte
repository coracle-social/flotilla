<script lang="ts">
  import {onMount} from "svelte"
  import type {Snippet} from "svelte"
  import {goto} from "$app/navigation"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT, ManagementMethod} from "@welshman/util"
  import {pubkey, repository, relaysByUrl, manageRelay} from "@welshman/app"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import {setKey} from "@lib/implicit"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import EventReport from "@app/components/EventReport.svelte"
  import EventShare from "@app/components/EventShare.svelte"
  import EventDeleteConfirm from "@app/components/EventDeleteConfirm.svelte"
  import {hasNip29, deriveUserIsSpaceAdmin} from "@app/core/state"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {makeSpaceChatPath} from "@app/util/routes"

  type Props = {
    url: string
    noun: string
    event: TrustedEvent
    onClick: () => void
    customActions?: Snippet
  }

  const {url, noun, event, onClick, customActions}: Props = $props()

  const isRoot = event.kind !== COMMENT
  const userIsAdmin = deriveUserIsSpaceAdmin(url)

  const report = () => pushModal(EventReport, {url, event})

  const showInfo = () => pushModal(EventInfo, {url, event})

  const share = async () => {
    if (hasNip29($relaysByUrl.get(url))) {
      pushModal(EventShare, {url, event})
    } else {
      setKey("share", event)
      goto(makeSpaceChatPath(url))
    }
  }

  const showDelete = () => pushModal(EventDeleteConfirm, {url, event})

  const showAdminDelete = () =>
    pushModal(Confirm, {
      title: `Delete ${noun}`,
      message: `Are you sure you want to delete this ${noun.toLowerCase()} from the space?`,
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

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-box bg-base-100 p-2 shadow-md" bind:this={ul}>
  {#if isRoot}
    <li>
      <Button onclick={share}>
        <Icon size={4} icon={ShareCircle} />
        Share to Chat
      </Button>
    </li>
  {/if}
  <li>
    <Button onclick={showInfo}>
      <Icon size={4} icon={Code2} />
      {noun} Details
    </Button>
  </li>
  {@render customActions?.()}
  {#if event.pubkey === $pubkey}
    <li>
      <Button onclick={showDelete} class="text-error">
        <Icon size={4} icon={TrashBin2} />
        Delete {noun}
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
          Delete {noun}
        </Button>
      </li>
    {/if}
  {/if}
</ul>
