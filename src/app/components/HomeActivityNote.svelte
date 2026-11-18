<script lang="ts">
  import {call, removeUndefined, uniq} from "@welshman/lib"
  import {REACTION, ZAP_RECEIPT, tagSpec, tagValue} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import EventQuoteAction from "@app/components/EventQuoteAction.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import NoteStats from "@app/components/NoteStats.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ReplyList from "@app/components/ReplyList.svelte"
  import {user} from "@app/core/user"
  import {displayActivityTimestamp} from "@app/areas/home/activity/stream"
  import {REPOST_KINDS} from "@app/areas/home/activity/model"
  import type {ActivityItem} from "@app/areas/home/activity/model"
  import type {Interactions} from "@app/features/interactions"
  import {pushModal} from "@app/navigation/dialogs"

  type Part = {pubkey?: string; text?: string}

  type Props = {
    item: Extract<ActivityItem, {type: "note"}>
    interactions: Interactions
  }

  const {item, interactions}: Props = $props()

  // An item keeps its key while it collects answers, so the component has to follow its prop.
  const {note, replies, reactions} = $derived(item)

  const repliers = $derived(uniq(replies.map(e => e.pubkey)))

  const reactors = $derived(uniq(reactions.filter(e => e.kind === REACTION).map(e => e.pubkey)))

  const reposters = $derived(
    uniq(reactions.filter(e => REPOST_KINDS.includes(e.kind)).map(e => e.pubkey)),
  )

  // A zap receipt is signed by the lnurl server, so the zapper is in the `P` tag.
  const zappers = $derived(
    uniq(
      removeUndefined(
        reactions.filter(e => e.kind === ZAP_RECEIPT).map(e => tagValue(tagSpec("P"), e.tags)),
      ),
    ),
  )

  const target = $derived(note.pubkey === $user.pubkey ? "your note" : "a thread you are in")

  // Whoever did the same things shares a clause, so nobody is named twice.
  const clauses = $derived(
    call(() => {
      const clauses = new Map<string, {pubkeys: string[]; verbsByObject: Map<string, string[]>}>()

      const addClause = (pubkeys: string[], verb: string, object: string) => {
        if (pubkeys.length > 0) {
          const key = pubkeys.toSorted().join()
          const clause = clauses.get(key) ?? {pubkeys, verbsByObject: new Map<string, string[]>()}
          const verbs = clause.verbsByObject.get(object) ?? []

          verbs.push(verb)
          clause.verbsByObject.set(object, verbs)
          clauses.set(key, clause)
        }
      }

      addClause(repliers, "replied", `to ${target}`)
      addClause(reactors, "reacted", `to ${target}`)
      addClause(reposters, "reposted", "this")
      addClause(zappers, "zapped", "this")

      return Array.from(clauses.values())
    }),
  )

  const words = (words: string[]) =>
    words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0]

  const parts = $derived(
    call(() => {
      // A note nobody answered or reacted to is in the stream because it names the user.
      if (clauses.length === 0) {
        return [{pubkey: note.pubkey, text: " mentioned you"}]
      }

      const parts: Part[] = []

      clauses.forEach(({pubkeys, verbsByObject}, i) => {
        const text = words(
          Array.from(verbsByObject, ([object, verbs]) => `${words(verbs)} ${object}`),
        )

        if (i > 0) {
          parts.push({text: i === clauses.length - 1 ? " and " : ", "})
        }

        if (pubkeys.length === 1) {
          parts.push({pubkey: pubkeys[0]}, {text: ` ${text}`})
        } else {
          parts.push({text: `${pubkeys.length} people ${text}`})
        }
      })

      return parts
    }),
  )

  const open = () => {
    pushModal(NoteStats, {event: note})
  }

  const openProfile = (pubkey: string) => () => pushModal(ProfileDetail, {pubkey})

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      open()
    }
  }
</script>

{#snippet quoteNote(event: TrustedEvent)}
  <EventQuoteAction {event} noun="Note" />
{/snippet}

<div class="flex flex-col gap-1">
  <div
    role="button"
    tabindex="0"
    class="-mx-2 flex min-w-0 cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-surface"
    onclick={open}
    onkeydown={onKeyDown}>
    <div class="min-w-0 flex-1 truncate text-sm opacity-75">
      {#each parts as part, i (i)}
        {#if part.pubkey}
          <Button class="link" onclick={openProfile(part.pubkey)}>
            <ProfileName pubkey={part.pubkey} />
          </Button>
        {/if}
        {part.text}
      {/each}
    </div>
    <span class="shrink-0 text-xs opacity-50">
      {displayActivityTimestamp(item.timestamp)}
    </span>
  </div>
  <NoteItem event={note} {interactions} customActions={quoteNote} showReply showThreadLinks />
  <ReplyList {replies} {interactions} {quoteNote} />
</div>
