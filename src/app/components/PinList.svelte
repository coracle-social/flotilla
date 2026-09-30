<script lang="ts">
  import {formatTimestampRelative, uniq} from "@welshman/lib"
  import type {PinReader} from "@welshman/domain"
  import {normalizeTopic} from "@lib/util"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Notice from "@lib/components/Notice.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PinDetail from "@app/components/PinDetail.svelte"
  import PinReference from "@app/components/PinReference.svelte"
  import PinSelectionMenu from "@app/components/PinSelectionMenu.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import {user} from "@app/core"
  import type {FeedContext} from "@app/feeds"
  import {deriveSpacePermissions} from "@app/management"
  import {
    deletePins,
    deriveShelves,
    displayPin,
    movePinsToShelf,
    removePinsFromShelf,
  } from "@app/pinboards"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    address: string
    pins: PinReader[]
    context: FeedContext
  }

  const {url, address, pins, context}: Props = $props()

  const shelves = deriveShelves(url)
  const permissions = deriveSpacePermissions(url)

  const selected = $derived(pins.filter(pin => selection.has(pin.event.id)))
  const allSelected = $derived(pins.length > 0 && selected.length === pins.length)
  const destinations = $derived($shelves.filter(shelf => shelf.address() !== address))

  // A pin is addressable, so shelving it is a rewrite only its author can publish.
  const canShelve = $derived(selected.every(pin => pin.event.pubkey === $user.pubkey))
  const canDelete = $derived(canShelve || $permissions.deleteContent)

  const toggle = (pin: PinReader) => () => {
    const next = new Set(selection)

    if (next.has(pin.event.id)) {
      next.delete(pin.event.id)
    } else {
      next.add(pin.event.id)
    }

    selection = next
  }

  const toggleAll = () => {
    selection = allSelected ? new Set() : new Set(pins.map(pin => pin.event.id))
  }

  const open = (pin: PinReader) => () => pushModal(PinDetail, {url, pin, context}, {size: "large"})

  const run = async (action: () => Promise<(string | undefined)[]>, message: string) => {
    loading = true

    try {
      const error = (await action()).find(Boolean)

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message})
        selection = new Set()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Some of those links could not be changed."})
    } finally {
      loading = false
    }
  }

  const remove = () =>
    run(
      () => removePinsFromShelf(url, selected, address),
      `${selected.length} taken off the shelf.`,
    )

  const confirmDelete = () =>
    pushModal(Confirm, {
      title: "Delete Links",
      message: `Delete ${selected.length} ${selected.length === 1 ? "link" : "links"} for everyone?`,
      confirm: () => run(() => deletePins(url, selected), `${selected.length} deleted.`),
    })

  const move = (destination: string) => {
    const moving = selected

    run(() => movePinsToShelf(url, moving, address, destination), `${moving.length} moved.`)
  }

  const explainShelve = () =>
    pushModal(Notice, {
      title: "You can't move those links",
      message: "Only the person who added a link can move it or take it off a shelf.",
    })

  const explainDelete = () =>
    pushModal(Notice, {
      title: "You can't delete those links",
      message: "Only the person who added a link, or an admin of this space, can delete it.",
    })

  let selection = $state(new Set<string>())
  let loading = $state(false)
</script>

<div data-component="PinList" class="flex flex-col bg-surface">
  <div
    class="flex h-14 items-center gap-3 border-b border-solid border-line bg-surface-less px-4 text-sm">
    <label class="flex items-center gap-2">
      <input type="checkbox" class="checkbox" checked={allSelected} onchange={toggleAll} />
      Select all
    </label>
    {#if selected.length > 0}
      <strong class="ml-auto">{selected.length} selected</strong>
      <MenuButton
        class="button button-neutral button-sm button-square"
        aria-label="Bulk actions"
        disabled={loading}
        component={PinSelectionMenu}
        componentProps={{
          shelves: destinations,
          onMove: canShelve ? move : explainShelve,
          onRemove: canShelve ? remove : explainShelve,
          onDelete: canDelete ? confirmDelete : explainDelete,
        }}>
        {#if loading}
          <Spinner size="sm" />
        {:else}
          <Icon icon={MenuDots} size={4} />
        {/if}
      </MenuButton>
    {/if}
  </div>
  {#each pins as pin (pin.event.id)}
    <div class="flex items-start gap-3 border-b border-solid border-line px-4 py-3">
      <input
        type="checkbox"
        class="checkbox mt-1"
        aria-label="Select {displayPin(pin)}"
        checked={selection.has(pin.event.id)}
        onchange={toggle(pin)} />
      <div class="flex min-w-0 grow flex-col gap-1">
        <Button class="min-w-0 wrap-break-word text-left" onclick={open(pin)}>
          {displayPin(pin)}
        </Button>
        {#if pin.title() && pin.content()}
          <p class="line-clamp-2 wrap-break-word text-sm text-content-muted">{pin.content()}</p>
        {/if}
        <div class="flex min-w-0 text-sm">
          <PinReference {url} {pin} />
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted">
          <span class="flex min-w-0 items-center gap-1.5">
            <ProfileCircle pubkey={pin.event.pubkey} {url} size={4} />
            <span class="truncate">
              <ProfileLink unstyled pubkey={pin.event.pubkey} {url} />
            </span>
          </span>
          <span>{formatTimestampRelative(pin.event.created_at)}</span>
          {#each uniq(pin.topics().map(normalizeTopic)) as topic (topic)}
            <span class="badge badge-sm rounded-full font-normal">#{topic}</span>
          {/each}
        </div>
      </div>
    </div>
  {/each}
</div>
