<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Profile from "@app/components/Profile.svelte"
  import {getRsvpsByStatus} from "@app/calendar"

  type Props = {
    url: string
    event: TrustedEvent
    rsvps: TrustedEvent[]
  }

  const {url, event, rsvps}: Props = $props()

  const people = $derived(getRsvpsByStatus(rsvps))

  const sections = $derived(
    [
      {label: "Going", pubkeys: people.accepted},
      {label: "Maybe", pubkeys: people.tentative},
      {label: "Can't go", pubkeys: people.declined},
    ].filter(section => section.pubkeys.length > 0),
  )
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-2">
    <p class="text-xs uppercase opacity-75">Host</p>
    <div class="card">
      <Profile pubkey={event.pubkey} {url} />
    </div>
  </div>
  {#each sections as section (section.label)}
    <div class="flex flex-col gap-2">
      <p class="text-xs uppercase opacity-75">{section.label} · {section.pubkeys.length}</p>
      {#each section.pubkeys as pubkey (pubkey)}
        <div class="card">
          <Profile {pubkey} {url} />
        </div>
      {/each}
    </div>
  {:else}
    <p class="flex items-center justify-center py-6 opacity-75">
      No one has responded yet — be the first.
    </p>
  {/each}
</div>
