<script lang="ts">
  import {insertAt, removeAt} from "@welshman/lib"
  import SettingsMinimalistic from "@assets/icons/settings-minimalistic.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import MenuSpacesItem from "@app/components/MenuSpacesItem.svelte"
  import SpaceAdd from "@app/components/SpaceAdd.svelte"
  import {userSpaceUrls, loadUserGroupList, PLATFORM_RELAYS} from "@app/core/state"
  import {setSpaceMembershipOrder} from "@app/core/commands"
  import {pushModal} from "@app/util/modal"

  const addSpace = () => pushModal(SpaceAdd)

  const reconcileUrls = (currentUrls: string[], nextUrls: string[]) => {
    const mergedUrls = currentUrls.filter(url => nextUrls.includes(url))

    for (const url of nextUrls) {
      if (!mergedUrls.includes(url)) {
        mergedUrls.push(url)
      }
    }

    return mergedUrls
  }

  const isSameOrder = (a: string[], b: string[]) =>
    a.length === b.length && a.every((url, index) => url === b[index])

  const reorderSpaceUrls = (targetUrl: string) => {
    if (!draggedUrl) {
      return
    }

    const sourceIndex = orderedSpaceUrls.indexOf(draggedUrl)
    const targetIndex = orderedSpaceUrls.indexOf(targetUrl)

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
      return
    }

    orderedSpaceUrls = insertAt(
      targetIndex,
      orderedSpaceUrls[sourceIndex],
      removeAt(sourceIndex, orderedSpaceUrls),
    )
  }

  const onDragStart = (e: DragEvent, url: string) => {
    draggedUrl = url
    dragStartOrder = [...orderedSpaceUrls]

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", url)
    }
  }

  const onDragOver = (e: DragEvent, targetUrl: string) => {
    e.preventDefault()
    reorderSpaceUrls(targetUrl)
  }

  const onDrop = (e: DragEvent, targetUrl: string) => {
    e.preventDefault()
    reorderSpaceUrls(targetUrl)
    draggedUrl = undefined

    if (dragStartOrder && !isSameOrder(dragStartOrder, orderedSpaceUrls)) {
      void setSpaceMembershipOrder(orderedSpaceUrls).catch(console.error)
    }

    dragStartOrder = undefined
  }

  const onDragEnd = () => {
    draggedUrl = undefined
    dragStartOrder = undefined
  }

  $effect(() => {
    const nextUrls = reconcileUrls(orderedSpaceUrls, $userSpaceUrls)

    if (!isSameOrder(nextUrls, orderedSpaceUrls)) {
      orderedSpaceUrls = nextUrls
    }
  })

  let orderedSpaceUrls = $state<string[]>([])
  let draggedUrl = $state<string | undefined>()
  let dragStartOrder = $state<string[] | undefined>()
</script>

<Page class="cw-full">
  <PageBar class="cw-full">
    {#snippet icon()}
      <div class="center">
        <Icon icon={SettingsMinimalistic} />
      </div>
    {/snippet}
    {#snippet title()}
      <strong>Your Spaces</strong>
    {/snippet}
    {#snippet action()}
      {#if $userSpaceUrls.length > 0 && PLATFORM_RELAYS.length === 0}
        <Button class="btn btn-primary btn-sm" onclick={addSpace}>
          <Icon icon={AddCircle} />
          Add Space
        </Button>
      {/if}
    {/snippet}
  </PageBar>
  <PageContent class="cw-full flex flex-col gap-2 p-2 pt-4">
    {#each PLATFORM_RELAYS as url (url)}
      <MenuSpacesItem {url} />
    {:else}
      {#await loadUserGroupList()}
        <div class="flex justify-center items-center py-20">
          <span class="loading loading-spinner mr-3"></span>
          Loading your spaces...
        </div>
      {:then}
        {#each orderedSpaceUrls as url (url)}
          <div
            class:opacity-60={draggedUrl === url}
            draggable="true"
            role="listitem"
            ondragstart={e => onDragStart(e, url)}
            ondragover={e => onDragOver(e, url)}
            ondrop={e => onDrop(e, url)}
            ondragend={onDragEnd}>
            <MenuSpacesItem {url} />
          </div>
        {:else}
          <div class="flex flex-col gap-8 items-center py-20">
            <p>You haven't added any spaces yet!</p>
            <Button class="btn btn-primary" onclick={addSpace}>
              <Icon icon={AddCircle} />
              Add a Space
            </Button>
          </div>
        {/each}
      {/await}
    {/each}
  </PageContent>
</Page>
