<script lang="ts">
  import {onDestroy} from "svelte"
  import {formatTimestampRelative} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {POLL_RESPONSE, tagSpec, tagValues, relay} from "@welshman/util"
  import {Poll, PollResponse} from "@welshman/domain"
  import type {Thunk} from "@welshman/app"
  import PollOption from "@app/components/PollOption.svelte"
  import {command, reader, thunks, user, writer} from "@app/core"
  import {deriveEvents} from "@app/repository"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const responses = deriveEvents([{kinds: [POLL_RESPONSE], "#e": [event.id]}])

  const getOwnResponse = (responses: TrustedEvent[]) => {
    let latest: TrustedEvent | undefined

    for (const response of responses) {
      if (
        response.pubkey === $user.pubkey &&
        (!latest || response.created_at > latest.created_at)
      ) {
        latest = response
      }
    }

    return latest
  }

  const publishSelection = async (selection: string[]) => {
    activeThunk?.abort()
    activeThunk = undefined

    if (selection.length > 0) {
      const eventWriter = writer(PollResponse).forceRoutes(relay(url)).setPollId(event.id)

      for (const id of selection) {
        eventWriter.addSelection(id)
      }

      const responseCommand = await command(eventWriter)

      // Give the user time to check more boxes before the vote actually goes out.
      activeThunk = $thunks.publish({
        event: responseCommand.event,
        relays: responseCommand.relays,
        delay: pollType === "multiplechoice" ? 1000 : undefined,
      })
    }
  }

  const publishCurrentSelection = () =>
    publishSelection(pollType === "singlechoice" ? selectedIds.slice(0, 1) : selectedIds)

  const setSingleChoice = (id: string) => {
    selectedIds = [id]
    publishCurrentSelection()
  }

  const toggleMultipleChoice = (id: string) => {
    selectedIds = selectedIds.includes(id)
      ? selectedIds.filter(selectedId => selectedId !== id)
      : [...selectedIds, id]

    publishCurrentSelection()
  }

  const poll = reader(Poll)(event)
  let selectedIds = $state<string[]>([])
  let activeThunk: Thunk | undefined

  const pollType = poll.pollType()
  const results = $derived(poll.results($responses))
  const ownResponse = $derived(getOwnResponse($responses))

  $effect(() => {
    if (ownResponse) {
      const selections = tagValues(tagSpec("response"), ownResponse.tags)

      selectedIds = pollType === "singlechoice" ? selections.slice(0, 1) : selections
    }
  })

  onDestroy(() => {
    activeThunk?.abort()
  })
</script>

{#if poll && results}
  {@const endsAt = poll.endsAt()}
  <div class="flex flex-col gap-2">
    {#each poll.options() as option (option.id)}
      <PollOption
        {event}
        {option}
        {results}
        {selectedIds}
        {setSingleChoice}
        {toggleMultipleChoice} />
    {/each}
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="text-sm opacity-75">
        {pollType === "multiplechoice" ? "Multiple choice" : "Single choice"}
        {#if endsAt}
          {#if poll.isClosed()}
            • Ended {formatTimestampRelative(endsAt)}
          {:else}
            • Ends {formatTimestampRelative(endsAt)}
          {/if}
        {/if}
      </div>
      <div class="text-sm opacity-75">{results.voters} vote{results.voters === 1 ? "" : "s"}</div>
    </div>
  </div>
{/if}
