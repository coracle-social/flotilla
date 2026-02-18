<script lang="ts">
  import type {Snippet} from "svelte"
  import {getAddress} from "@welshman/util"
  import History from "@assets/icons/history.svg?dataurl"
  import Minus from "@assets/icons/minus.svg?dataurl"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import SecondaryNavHeader from "@lib/components/SecondaryNavHeader.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import Page from "@lib/components/Page.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {userFeeds} from "@app/core/state"

  type Props = {
    children?: Snippet
  }

  const {children}: Props = $props()
</script>

<SecondaryNav>
  <SecondaryNavSection>
    <SecondaryNavItem href="/home">
      <Icon icon={History} /> Recent Activity
    </SecondaryNavItem>
  </SecondaryNavSection>
  <SecondaryNavSection>
    <SecondaryNavHeader>Your Feeds</SecondaryNavHeader>
    {#each $userFeeds as feed (feed.event.id)}
      <SecondaryNavItem href="/home/feed/{getAddress(feed.event)}">
        <Icon icon={Minus} />
        {feed.title}
      </SecondaryNavItem>
    {/each}
  </SecondaryNavSection>
</SecondaryNav>
<Page>
  {@render children?.()}
</Page>
