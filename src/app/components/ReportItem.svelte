<script lang="ts">
  import {formatTimestamp} from "@welshman/lib"
  import {getTag, getIdFilters} from "@welshman/util"
  import {load, LOCAL_RELAY_URL} from "@welshman/net"
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import ReportMenu from "@app/components/ReportMenu.svelte"
  import {pushModal} from "@app/util/modal"
  import {goToEvent} from "@app/util/routes"

  type Props = {
    url: string
    event: TrustedEvent
    onDelete?: () => void
  }

  const {url, event, onDelete}: Props = $props()

  const etag = getTag("e", event.tags)
  const ptag = getTag("p", event.tags)
  const reason = etag?.[2] || ptag?.[2]

  const onClick = (e: Event, event: TrustedEvent) => {
    // @ts-ignore
    if (e.target?.classList.contains("profile-name")) {
      pushModal(ProfileDetail, {pubkey: event.pubkey, url})
    } else {
      goToEvent(event)
    }
  }
</script>

<div class="column gap-4 card2 card2-sm bg-alt">
  <div class="flex justify-between">
    <div>
      <ProfileName pubkey={event.pubkey} {url} />
      <span>
        Reported this event
        {#if reason}
          as "{reason}"
        {/if}
      </span>
    </div>
    <ReportMenu {url} {event} {onDelete} />
  </div>
  {#if event.content}
    <div class="border-l-2 border-primary pl-3">
      <NoteContent {event} />
    </div>
  {/if}
  <div class="card2 card2-sm bg-alt">
    {#if etag}
      {#await load({relays: [url, LOCAL_RELAY_URL], filters: getIdFilters([etag[1]])})}
        <p>Loading</p>
      {:then reportedEvents}
        {#if reportedEvents.length === 0}
          <p>Unable to find reported note.</p>
        {:else}
          {@const event = reportedEvents[0]}
          <Button class="col-2 w-full" onclick={(e: Event) => onClick(e, event)}>
            <div class="flex items-center justify-between gap-2">
              <span class="profile-name">
                @<ProfileName pubkey={event.pubkey} {url} />
              </span>
              <span class="text-xs opacity-75">
                {formatTimestamp(event.created_at)}
              </span>
            </div>
            <NoteContent {event} />
          </Button>
        {/if}
      {/await}
    {:else if ptag}
      <Profile pubkey={ptag[1]} />
    {/if}
  </div>
</div>
