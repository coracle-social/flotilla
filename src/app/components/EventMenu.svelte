<script lang="ts">
  import type {Snippet} from "svelte"
  import {readable} from "svelte/store"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT} from "@welshman/util"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import Report from "@app/components/Report.svelte"
  import EventAdminDeleteConfirm from "@app/components/EventAdminDeleteConfirm.svelte"
  import EventDeleteConfirm from "@app/components/EventDeleteConfirm.svelte"
  import PinboardSelect from "@app/components/PinboardSelect.svelte"
  import {shareEvent} from "@app/share"
  import {deriveUserAdminDelete} from "@app/rooms"
  import {pushModal} from "@app/modal"
  import {user} from "@app/core"

  type Props = {
    url?: string
    noun: string
    event: TrustedEvent
    onClick: () => void
    customActions?: Snippet
  }

  const {url, noun, event, onClick, customActions}: Props = $props()

  const isRoot = event.kind !== COMMENT

  // A note from the network belongs to no space, so everything a space relay answers for is absent.
  const adminDelete = url ? deriveUserAdminDelete(url, event) : readable(undefined)

  const showInfo = () => pushModal(EventInfo, {url, event})

  const showDelete = () => pushModal(EventDeleteConfirm, {url, event})

  const report = (spaceUrl: string) => () => pushModal(Report, {url: spaceUrl, event})

  const addToLibrary = (spaceUrl: string) => () => pushModal(PinboardSelect, {url: spaceUrl, event})

  const share = (spaceUrl: string) => () => shareEvent(spaceUrl, noun, event)

  const showAdminDelete = (spaceUrl: string) => () =>
    pushModal(EventAdminDeleteConfirm, {url: spaceUrl, noun, event})
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" onclickcapture={onClick}>
  <li>
    <Button onclick={showInfo}>
      <Icon size={4} icon={Code2} />
      {noun} Details
    </Button>
  </li>
  {#if url}
    {#if isRoot}
      <li>
        <Button onclick={share(url)}>
          <Icon size={4} icon={ShareCircle} />
          Share to Chat
        </Button>
      </li>
    {/if}
    <li>
      <Button onclick={addToLibrary(url)}>
        <Icon size={4} icon={GalleryWide} />
        Add to Library
      </Button>
    </li>
  {/if}
  {@render customActions?.()}
  {#if event.pubkey === $user.pubkey}
    <li>
      <Button onclick={showDelete} class="text-error">
        <Icon size={4} icon={TrashBin2} />
        Delete {noun}
      </Button>
    </li>
  {:else if url}
    <li>
      <Button class="text-error" onclick={report(url)}>
        <Icon size={4} icon={Danger} />
        Report Content
      </Button>
    </li>
    {#if $adminDelete}
      <li>
        <Button class="text-error" onclick={showAdminDelete(url)}>
          <Icon size={4} icon={TrashBin2} />
          Delete {noun}
        </Button>
      </li>
    {/if}
  {/if}
</ul>
