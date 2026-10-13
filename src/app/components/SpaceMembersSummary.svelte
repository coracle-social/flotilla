<script lang="ts">
  import {derived} from "svelte/store"
  import {RELAY_ADD_MEMBER, RELAY_JOIN, hexTags, tagValues} from "@welshman/util"
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Profile from "@app/components/Profile.svelte"
  import {events, relayMemberLists, relays} from "@app/core/plugins"
  import {makeSpacePath} from "@app/ui/routes"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = $relays.one(url)
  const members = $relayMemberLists.forUrl(url)
  const memberEvents = $events.forUrl(url, [{kinds: [RELAY_ADD_MEMBER, RELAY_JOIN]}]).$

  const admins = $derived($relay?.pubkey ? [$relay.pubkey] : [])

  const directoryPath = makeSpacePath(url, "directory")

  // Members sorted by their most recent join/add event, excluding admins.
  const newMembers = derived(
    [members, memberEvents, relay],
    ([$members, $memberEvents, $relay]) => {
      const adminSet = new Set($relay?.pubkey ? [$relay.pubkey] : [])
      const joinedAt = new Map<string, number>()

      for (const event of $memberEvents) {
        const pubkeys =
          event.kind === RELAY_JOIN ? [event.pubkey] : tagValues(hexTags("p"), event.tags)

        for (const pubkey of pubkeys) {
          joinedAt.set(pubkey, Math.max(joinedAt.get(pubkey) || 0, event.created_at))
        }
      }

      return ($members?.pubkeys() ?? [])
        .filter(pubkey => !adminSet.has(pubkey))
        .sort((a, b) => (joinedAt.get(b) || 0) - (joinedAt.get(a) || 0))
        .slice(0, 5)
    },
  )
</script>

<div class="card flex flex-col gap-3">
  <h3 class="flex items-center gap-2 text-lg font-bold">
    <Icon icon={UsersGroup} />
    Members
  </h3>
  {#if admins.length > 0}
    <div class="flex flex-col gap-2">
      <p class="text-xs uppercase tracking-wide opacity-60">Admins</p>
      {#each admins as pubkey (pubkey)}
        <Profile {pubkey} {url} />
      {/each}
    </div>
  {/if}
  {#if $newMembers.length > 0}
    <div class="flex flex-col gap-2">
      <p class="text-xs uppercase tracking-wide opacity-60">New members</p>
      {#each $newMembers as pubkey (pubkey)}
        <Profile {pubkey} {url} />
      {/each}
    </div>
  {/if}
  <Link href={directoryPath} class="button button-neutral button-sm">
    View all members
    <Icon icon={AltArrowRight} size={4} />
  </Link>
</div>
