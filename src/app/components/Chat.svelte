<script lang="ts">
  import type {Snippet} from "svelte"
  import {onDestroy, onMount} from "svelte"
  import {
    ago,
    int,
    ms,
    partition,
    ifLet,
    spec,
    nthEq,
    nthNe,
    MINUTE,
    sortBy,
    remove,
    enumerate,
    formatTimestampAsDate,
  } from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent, EventTemplate, EventContent} from "@welshman/util"
  import {makeEvent, userInbox, DIRECT_MESSAGE, DIRECT_MESSAGE_FILE} from "@welshman/util"
  import {parse, isLink} from "@welshman/content"
  import {MessagingRelayLists, Thunks} from "@welshman/app"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import ArrowLeft from "@assets/icons/arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ChatMembers from "@app/components/ChatMembers.svelte"
  import ChatMessage from "@app/components/ChatMessage.svelte"
  import ChatCompose from "@app/components/ChatCompose.svelte"
  import ComposeEdit from "@app/components/ComposeEdit.svelte"
  import ComposeParent from "@app/components/ComposeParent.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import {app, deletes, router, user, wraps} from "@app/core"
  import {userSettingsValues} from "@app/settings"
  import {deriveChat, makeChatId} from "@app/chats"
  import {makeFeedContext} from "@app/feeds"
  import {navigate, pushModal} from "@app/modal"
  import {DraftKey, type Draft} from "@app/drafts"
  import {prependParent} from "@app/rooms"
  import {pendingShare, type Share} from "@app/share"
  import {pushToast} from "@app/toast"

  type Props = {
    pubkeys: string[]
    info?: Snippet
  }

  const {pubkeys, info}: Props = $props()

  const chatId = makeChatId(pubkeys)
  const context = makeFeedContext({relays: $router.resolver.relays([userInbox()])})

  onDestroy(context.cleanup)
  const chat = deriveChat(chatId)
  const draftKey = new DraftKey<Draft>(`dm:${chatId}`)
  const others = remove($user.pubkey, pubkeys)
  const messagingRelayLists = $app.use(MessagingRelayLists).index.$
  const missingRelayLists = $derived(others.filter(pk => !$messagingRelayLists.has(pk)))

  const showMembers = () =>
    others.length === 1
      ? pushModal(ProfileDetail, {pubkey: others[0]})
      : pushModal(ChatMembers, {pubkeys: others})

  const back = () => navigate("/chat")

  const replyTo = (event: TrustedEvent) => {
    parent = event
    compose?.focus()
  }

  const clearParent = () => {
    parent = undefined
  }

  const clearEventToEdit = () => {
    eventToEdit = undefined
  }

  const onSubmit = async (params: EventContent) => {
    const ptags = others.map(pk => ["p", pk])

    // Remove p tags since they result in forking the conversation
    params.tags = params.tags.filter(nthNe(0, "p"))

    // Add our reply quote to content
    params = await prependParent(parent, params)

    if (eventToEdit) {
      // An edit that changes nothing is just a dismissal
      if (eventToEdit.content === params.content) {
        return clearEventToEdit()
      }

      const command = await $deletes.deleteEvent(eventToEdit)

      await $wraps.publish({event: command.event, recipients: pubkeys, pow: 16})
    }

    const [imetaTags, tags] = partition(nthEq(0, "imeta"), params.tags)
    const imetas = imetaTags.map(tag => tag.slice(1).map(entry => entry.split(" ")))
    const templates: EventTemplate[] = []
    const buffer = []

    const addTemplate = (kind: number, content: string, tags: string[][]) => {
      content = content.trim()

      if (content) {
        templates.push(
          makeEvent(kind, {
            content,
            tags: [...tags, ...ptags],
            created_at: eventToEdit?.created_at,
          }),
        )
      }
    }

    for (const p of parse(params)) {
      const imeta = isLink(p)
        ? imetas.find(tags => tags.find(spec(["url", p.value.url.toString()])))
        : undefined

      if (isLink(p) && imeta) {
        addTemplate(DIRECT_MESSAGE, buffer.splice(0).join(""), tags)
        addTemplate(DIRECT_MESSAGE_FILE, p.value.url.toString(), imeta.filter(nthNe(0, "url")))
      } else {
        buffer.push(p.raw)
      }
    }

    addTemplate(DIRECT_MESSAGE, buffer.splice(0).join(""), tags)

    // Split the message into multiple pieces so that we can use kind 15 to send images per nip 17
    // Sleep 1 second between each one to make sure timestamps are distinct
    const thunks = await Promise.all(
      Array.from(enumerate(templates)).map(([i, event]) =>
        $wraps.publish({
          event,
          recipients: pubkeys,
          delay: $userSettingsValues.send_delay + ms(i),
          pow: 16,
        }),
      ),
    )

    // Only once the message exists. Publishing has to read each recipient's messaging relays first,
    // and a failed read throws before any thunk is made — so the reply or edit this was part of has
    // to survive that along with the draft the composer is holding on to.
    clearParent()
    clearEventToEdit()

    pushToast({
      timeout: 30_000,
      children: {
        component: ThunkToast,
        props: {thunk: $app.use(Thunks).merge(thunks)},
      },
    })
  }

  const onEscape = () => {
    clearParent()
    clearEventToEdit()
  }

  const canEditEvent = (event: TrustedEvent) =>
    event.pubkey === $user.pubkey &&
    event.kind === DIRECT_MESSAGE &&
    event.created_at >= ago(500, MINUTE)

  const onEditEvent = (event: TrustedEvent) => {
    clearParent()
    eventToEdit = event
  }

  const onEditPrevious = () => ifLet($chat?.messages.find(canEditEvent), onEditEvent)

  let loading = $state(true)
  let compose: ChatCompose | undefined = $state()
  let parent: TrustedEvent | undefined = $state()
  let eventToEdit: TrustedEvent | undefined = $state()
  let share: Maybe<Share> = $state()

  // Claim the share once we're on screen. Sharing into the conversation you're already looking at
  // doesn't re-create this component, so this can't be read once on mount.
  $effect(() => {
    if ($pendingShare) {
      share = $pendingShare
      pendingShare.set(undefined)
    }
  })

  const initialValues = $derived.by((): Share | undefined => {
    if (eventToEdit) {
      return {type: "text", value: eventToEdit.content}
    }

    if (share) {
      return share
    }
  })

  const elements = $derived.by(() => {
    const elements = []

    let previousDate
    let previousPubkey
    let previousCreatedAt = 0

    for (const event of sortBy(e => e.created_at, $chat?.messages || [])) {
      const {id, pubkey, created_at} = event
      const date = formatTimestampAsDate(created_at)

      if (date !== previousDate) {
        elements.push({type: "date", value: date, id: date, showPubkey: false})
      }

      elements.push({
        id,
        type: "note",
        value: event,
        showPubkey: created_at - previousCreatedAt > int(2, MINUTE) || previousPubkey !== pubkey,
      })

      previousDate = date
      previousPubkey = pubkey
      previousCreatedAt = created_at
    }

    return elements.reverse()
  })

  onMount(() => {
    for (const pubkey of others) {
      $app.use(MessagingRelayLists).load(pubkey)
    }
  })

  setTimeout(() => {
    loading = false
  }, 5000)
</script>

<PageBar>
  <div class="flex">
    <Button onclick={back} class="place-self-start pr-3 md:hidden flex items-center">
      <Icon icon={ArrowLeft} size={7} />
    </Button>
    <div class="flex items-center justify-between gap-4">
      <div class="truncate min-w-0 flex items-center gap-4 whitespace-nowrap">
        <Button class="flex flex-col gap-1 sm:flex-row sm:gap-2" onclick={showMembers}>
          {#if others.length === 0}
            <div class="flex gap-2">
              <ProfileCircle pubkey={$user.pubkey} size={5} />
              <ProfileName pubkey={$user.pubkey} />
            </div>
          {:else if others.length === 1}
            <div class="flex gap-2">
              <ProfileCircle pubkey={others[0]} size={5} />
              <ProfileName pubkey={others[0]} />
            </div>
          {:else}
            <div class="flex items-center gap-2">
              <ProfileCircles pubkeys={others} size={5} />
              <p class="overflow-hidden text-ellipsis whitespace-nowrap">
                <ProfileName pubkey={others[0]} />
                and
                {#if others.length === 2}
                  <ProfileName pubkey={others[1]} />
                {:else}
                  {others.length - 1}
                  {others.length > 2 ? "others" : "other"}
                {/if}
              </p>
            </div>
          {/if}
        </Button>
      </div>
    </div>
  </div>
</PageBar>

<div class="room flex min-h-0 min-w-0 flex-1 flex-col">
  <PageContent class="flex flex-col-reverse gap-4 py-2 bg-surface !mb-0">
    {#if missingRelayLists.length > 0}
      <div class="py-12">
        <div class="card flex flex-col gap-2 m-auto max-w-md items-center text-center">
          <p class="flex gap-2 text-lg text-error">
            <Icon icon={Danger} />
            Direct messages are not enabled
          </p>
          <p>
            Ask
            {#each missingRelayLists as pubkey (pubkey)}
              <ProfileLink {pubkey} />
            {/each}
            to enable direct messaging by opening this conversation in their client.
          </p>
        </div>
      </div>
    {/if}
    {#each elements as { type, id, value, showPubkey } (id)}
      {#if type === "date"}
        <Divider>{value}</Divider>
      {:else}
        <ChatMessage
          event={$state.snapshot(value as TrustedEvent)}
          {pubkeys}
          {showPubkey}
          {context}
          {replyTo}
          canEdit={canEditEvent}
          onEdit={onEditEvent} />
      {/if}
    {/each}
    <p
      class="m-auto flex h-10 max-w-sm flex-col items-center justify-center gap-4 py-20 text-center">
      <Spinner {loading}>
        {#if loading}
          Looking for messages...
        {:else}
          End of message history
        {/if}
      </Spinner>
      {@render info?.()}
    </p>
  </PageContent>

  <div class="room__compose bg-surface">
    <div class="flex flex-col gap-px">
      {#if parent}
        <ComposeParent event={parent} clear={clearParent} verb="Replying to" />
      {/if}
      {#if eventToEdit}
        <ComposeEdit clear={clearEventToEdit} />
      {/if}
    </div>
    {#key initialValues}
      <ChatCompose
        bind:this={compose}
        {onSubmit}
        {onEscape}
        {onEditPrevious}
        {initialValues}
        draftKey={eventToEdit ? undefined : draftKey}
        disabled={Boolean(missingRelayLists.length)} />
    {/key}
  </div>
</div>
