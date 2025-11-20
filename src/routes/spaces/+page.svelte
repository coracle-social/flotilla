<script lang="ts">
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
  import {pushModal} from "@app/util/modal"

  const addSpace = () => pushModal(SpaceAdd)
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
        {#each $userSpaceUrls as url (url)}
          <MenuSpacesItem {url} />
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
