<script lang="ts">
  import {tweened} from "svelte/motion"
  import type {TrustedEvent} from "@welshman/util"
  import {noop, spec} from "@welshman/lib"
  import {Poll} from "@welshman/domain"
  import {stopPropagation} from "@lib/html"
  import {reader} from "@app/core/domain"

  type Props = {
    event: TrustedEvent
    option: {id: string; label: string}
    results: {voters: number; options: {id: string; votes: number}[]}
    selectedIds: string[]
    setSingleChoice: (id: string) => void
    toggleMultipleChoice: (id: string) => void
  }

  const {event, option, results, selectedIds, setSingleChoice, toggleMultipleChoice}: Props =
    $props()

  const poll = reader(Poll)(event)
  const pollType = poll.pollType()
  const closed = poll.isClosed()

  const selected = $derived(
    pollType === "singlechoice" ? selectedIds[0] === option.id : selectedIds.includes(option.id),
  )
  const onselect = () =>
    pollType === "singlechoice" ? setSingleChoice(option.id) : toggleMultipleChoice(option.id)

  const votes = $derived(results.options.find(spec({id: option.id}))?.votes || 0)
  const maxVotes = $derived(Math.max(...results.options.map(r => r.votes), 1))

  const tweenedVotes = tweened(votes, {duration: 300})
  const tweenedMax = tweened(maxVotes, {duration: 300})

  $effect(() => {
    tweenedVotes.set(votes)
  })

  $effect(() => {
    tweenedMax.set(maxVotes)
  })
</script>

<div class="flex flex-col gap-2 card card-sm">
  <div class="flex items-center justify-between gap-2">
    <label class="flex min-w-0 grow items-center gap-2">
      {#if !closed}
        {#if pollType === "singlechoice"}
          <input
            name={event.id}
            type="radio"
            class="radio"
            checked={selected}
            onclick={stopPropagation(noop)}
            onchange={onselect} />
        {:else}
          <input
            type="checkbox"
            class="checkbox"
            checked={selected}
            onclick={stopPropagation(noop)}
            onchange={onselect} />
        {/if}
      {/if}
      <span class="truncate">{option.label}</span>
    </label>
    <span class="whitespace-nowrap text-xs opacity-75">{votes} vote{votes === 1 ? "" : "s"}</span>
  </div>
  <progress class="progress" value={$tweenedVotes} max={$tweenedMax}></progress>
</div>
