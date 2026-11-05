<script lang="ts">
  import {call, removeUndefined, uniq} from "@welshman/lib"
  import {REACTION, ZAP_RECEIPT, sortEventsDesc, tagSpec, tagValue} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import EventQuoteAction from "@app/components/EventQuoteAction.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import NoteStats from "@app/components/NoteStats.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {user} from "@app/core/user"
  import type {FeedContext} from "@app/features/feeds"
  import {REPOST_KINDS, displayActivityTimestamp} from "@app/features/activity"
  import type {HomeNotification} from "@app/features/activity"
  import {notes} from "@app/features/social"
  import {pushModal} from "@app/navigation/dialogs"
  import {openEventNote} from "@app/navigation/overlays"

  type Part = {pubkey?: string; text?: string}

  type Props = {
    notification: HomeNotification
    context: FeedContext
  }

  const {notification, context}: Props = $props()

  const {ref} = notification

  // A notification keeps its key while it collects answers, so the component has to follow its prop.
  const replies = $derived(notification.replies)

  const interactions = $derived(notification.reactions)

  // The note this notification is about, fetched from the hints the events naming it carried.
  const note = $notes.deriveEvent(ref)

  const repliers = $derived(uniq(replies.map(e => e.pubkey)))

  const reactors = $derived(uniq(interactions.filter(e => e.kind === REACTION).map(e => e.pubkey)))

  const reposters = $derived(
    uniq(interactions.filter(e => REPOST_KINDS.includes(e.kind)).map(e => e.pubkey)),
  )

  // A zap receipt is signed by the lnurl server, so the zapper is in the `P` tag.
  const zappers = $derived(
    uniq(
      removeUndefined(
        interactions.filter(e => e.kind === ZAP_RECEIPT).map(e => tagValue(tagSpec("P"), e.tags)),
      ),
    ),
  )

  const target = $derived($note?.pubkey === $user.pubkey ? "your note" : "a thread you are in")

  const actions = $derived(
    call(() => {
      const actions: {pubkeys: string[]; verb: string; object: string}[] = []

      if (repliers.length > 0) {
        actions.push({pubkeys: repliers, verb: "replied", object: `to ${target}`})
      }
      if (reactors.length > 0) {
        actions.push({pubkeys: reactors, verb: "reacted", object: `to ${target}`})
      }
      if (reposters.length > 0) {
        actions.push({pubkeys: reposters, verb: "reposted", object: "this"})
      }
      if (zappers.length > 0) {
        actions.push({pubkeys: zappers, verb: "zapped", object: "this"})
      }

      return actions
    }),
  )

  // Whoever did the same things shares a clause, so nobody is named twice.
  const clauses = $derived(
    call(() => {
      const clauses = new Map<string, {pubkeys: string[]; verbsByObject: Map<string, string[]>}>()

      for (const {pubkeys, verb, object} of actions) {
        const key = pubkeys.toSorted().join()
        const clause = clauses.get(key) ?? {pubkeys, verbsByObject: new Map<string, string[]>()}
        const verbs = clause.verbsByObject.get(object) ?? []

        verbs.push(verb)
        clause.verbsByObject.set(object, verbs)
        clauses.set(key, clause)
      }

      return Array.from(clauses.values())
    }),
  )

  const words = (words: string[]) =>
    words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0]

  const parts = $derived(
    call(() => {
      // A note nobody answered or reacted to is in the stream because it names the user.
      if (clauses.length === 0 && $note) {
        return [{pubkey: $note.pubkey, text: " mentioned you"}]
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

  let showEvery = $state(false)

  const sorted = $derived(sortEventsDesc(replies))

  const shown = $derived(showEvery ? sorted : sorted.slice(0, 3))

  const open = () => {
    if ($note) {
      pushModal(NoteStats, {event: $note})
    }
  }

  const openProfile = (pubkey: string) => () => pushModal(ProfileDetail, {pubkey})

  const openReply = (reply: TrustedEvent) => () => openEventNote(reply)

  const showAll = () => {
    showEvery = true
  }

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

{#if $note}
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
        {displayActivityTimestamp(notification.timestamp)}
      </span>
    </div>
    <NoteItem event={$note} {context} customActions={quoteNote} showReply showThreadLinks />
    {#if shown.length > 0}
      <div class="border-line-less ml-4 flex flex-col gap-3 border-l pt-3 pl-4">
        {#each shown as reply (reply.id)}
          <NoteItem
            event={reply}
            {context}
            customActions={quoteNote}
            card={false}
            interactive
            showReply
            onOpen={openReply(reply)} />
        {/each}
        {#if shown.length < replies.length}
          <Button class="link self-start text-sm" onclick={showAll}>
            Show {replies.length - shown.length} more
          </Button>
        {/if}
      </div>
    {/if}
  </div>
{/if}
