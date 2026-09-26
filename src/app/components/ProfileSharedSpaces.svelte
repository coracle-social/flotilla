<script lang="ts">
  import cx from "classnames"
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import RelayIcon from "@app/components/RelayIcon.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import {userSpaceUrls} from "@app/rooms"
  import {roomLists} from "@app/core"
  import {makeSpacePath} from "@app/routes"

  type Props = {
    pubkey: string
    isSelf?: boolean
    class?: string
  }

  const {pubkey, isSelf = false, ...props}: Props = $props()

  const roomList = $roomLists.one(pubkey)
  const spaceUrls = $derived($roomList?.urls() ?? [])
</script>

<div class={cx("card card-sm flex flex-col gap-3 sm:gap-4", props.class)}>
  <div class="flex items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      <Icon icon={UsersGroup} size={5} />
      <strong>Spaces</strong>
    </div>
    <span class="badge badge-neutral">{spaceUrls.length}</span>
  </div>
  {#if spaceUrls.length > 0}
    <div class="flex flex-col gap-2 border-t border-line pt-4">
      {#each spaceUrls as url (url)}
        {@const count = $roomLists.pubkeysForUrl(url).get().length}
        {@const isMember = !isSelf && $userSpaceUrls.includes(url)}
        <Link
          href={makeSpacePath(url)}
          class="card card-interactive flex flex-row items-center justify-between gap-3 p-3 sm:p-4">
          <RelayIcon {url} size={8} />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <RelayName {url} class="truncate text-sm font-medium" />
              {#if isMember}
                <span class="badge badge-primary text-xs">Member</span>
              {/if}
            </div>
            <p class="text-xs opacity-75">
              {#if count >= 1000}
                {(count / 1000).toFixed(1).replace(/\.0$/, "")}K members
              {:else}
                {count} {count === 1 ? "member" : "members"}
              {/if}
            </p>
          </div>
        </Link>
      {/each}
    </div>
  {:else}
    <p class="border-t border-line pt-4 text-sm opacity-75">
      {isSelf ? "You aren't in any spaces yet." : "No spaces found."}
    </p>
  {/if}
</div>
