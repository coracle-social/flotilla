<script lang="ts">
  import Bookmark from "@assets/icons/bookmark.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Card from "@lib/components/Card.svelte"
  import Content from "@app/components/Content.svelte"
  import EditFeaturedContent from "@app/components/EditFeaturedContent.svelte"
  import {deriveFeaturedContent} from "@app/featured"
  import {deriveUserIsSpaceAdmin} from "@app/management"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const content = deriveFeaturedContent(url)
  const canEdit = deriveUserIsSpaceAdmin(url)

  const edit = () => pushModal(EditFeaturedContent, {url, initial: $content})
</script>

{#if $content.length > 0 || $canEdit}
  <Card class="bg-surface flex flex-col gap-3 @container">
    <div class="flex items-center justify-between gap-2">
      <h3 class="flex items-center gap-2 text-lg font-bold">
        <Icon icon={Bookmark} />
        Featured
      </h3>
      {#if $canEdit}
        <Button class="button button-ghost button-sm button-square" onclick={edit}>
          <Icon icon={Pen} />
        </Button>
      {/if}
    </div>
    {#if $content.length === 0}
      <p class="text-sm opacity-70">No featured content yet.</p>
    {:else}
      <div class="grid grid-cols-1 @md:grid-cols-2 gap-2">
        {#each $content as value (value)}
          <Content event={{content: value, tags: []}} {url} />
        {/each}
      </div>
    {/if}
  </Card>
{/if}
