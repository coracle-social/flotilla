<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {
    ago,
    int,
    ms,
    partition,
    spec,
    nthEq,
    nthNe,
    MINUTE,
    sortBy,
    remove,
    enumerate,
    formatTimestampAsDate,
  } from "@welshman/lib"
  import type {TrustedEvent, EventTemplate} from "@welshman/util"
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
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import ChatMembers from "@app/components/ChatMembers.svelte"
  import ChatTitle from "@app/components/ChatTitle.svelte"
  import ChatMessage from "@app/components/ChatMessage.svelte"
  import ComposeArea, {type ComposeValues} from "@app/components/ComposeArea.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import {app, deletes, router, user, wraps} from "@app/core"
  import {loadSendDelay} from "@app/settings"
  import {chats, makeChatId} from "@app/chats"
  import {makeFeedContext} from "@app/feeds"
  import {navigate, pushModal} from "@app/modal"
  import {prependParent} from "@app/rooms"
  import type {RoomRow} from "@app/rooms"
  import {pushToast} from "@app/toast"

  type Props = {
    pubkeys: string[]
  }

  const {pubkeys}: Props = $props()

  const chatId = makeChatId(pubkeys)
  const context = makeFeedContext({relays: $router.resolver.relays([userInbox()])})

  onDestroy(context.cleanup)
  const chat = $chats.one(chatId)
  const others = remove($user.pubkey, pubkeys)
  const messagingRelayLists = $app.use(MessagingRelayLists).index.$
  const missingRelayLists = $derived(others.filter(pk => !$messagingRelayLists.has(pk)))

  const showMembers = () =>
    others.length === 1
      ? pushModal(ProfileDetail, {pubkey: others[0]})
      : pushModal(ChatMembers, {pubkeys: others})

  const back = () => navigate("/chat")

  const replyTo = (event: TrustedEvent) => composeArea?.reply(event)

  const onSubmit = async ({parent, edit, ...values}: ComposeValues) => {
    const ptags = others.map(pk => ["p", pk])

    // p tags would fork the conversation, so drop them before quoting the parent
    const params = await prependParent(parent, {
      content: values.content,
      tags: values.tags.filter(nthNe(0, "p")),
    })

    if (edit) {
      const command = await $deletes.deleteEvent(edit)

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
            created_at: edit?.created_at,
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

    const delay = await loadSendDelay()

    // Kind 15 carries one image each per nip 17, and a second's sleep keeps the timestamps distinct.
    const thunks = await Promise.all(
      Array.from(enumerate(templates)).map(([i, event]) =>
        $wraps.publish({
          event,
          recipients: pubkeys,
          delay: delay + ms(i),
          pow: 16,
        }),
      ),
    )

    pushToast({
      timeout: 30_000,
      children: {
        component: ThunkToast,
        props: {thunk: $app.use(Thunks).merge(thunks)},
      },
    })
  }

  const canEditEvent = (event: TrustedEvent) =>
    event.pubkey === $user.pubkey &&
    event.kind === DIRECT_MESSAGE &&
    event.created_at >= ago(500, MINUTE)

  const onEditEvent = (event: TrustedEvent) => composeArea?.edit(event)

  let loading = $state(true)
  let composeArea: ComposeArea | undefined = $state()

  const elements = $derived.by(() => {
    const elements: RoomRow[] = []

    let previousDate
    let previousPubkey
    let previousCreatedAt = 0

    for (const event of sortBy(e => e.created_at, $chat?.messages || [])) {
      const {id, pubkey, created_at} = event
      const date = formatTimestampAsDate(created_at)

      if (date !== previousDate) {
        elements.push({type: "date", value: date, id: date})
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
          <div class="flex items-center gap-2">
            {#if others.length > 1}
              <ProfileCircles pubkeys={others} size={5} />
            {:else}
              <ProfileCircle pubkey={others[0] || $user.pubkey} size={5} />
            {/if}
            <p class="overflow-hidden text-ellipsis whitespace-nowrap">
              <ChatTitle {pubkeys} />
            </p>
          </div>
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
    {#each elements as row (row.id)}
      {#if row.type === "date"}
        <Divider>{row.value}</Divider>
      {:else if row.type === "note"}
        <ChatMessage
          event={$state.snapshot(row.value)}
          {pubkeys}
          showPubkey={row.showPubkey}
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
    </p>
  </PageContent>

  <div class="room__compose bg-surface px-2">
    <ComposeArea
      {onSubmit}
      encryptFiles
      draftKey="dm:{chatId}"
      messages={$chat?.messages || []}
      canEdit={canEditEvent}
      disabled={Boolean(missingRelayLists.length)}
      bind:this={composeArea} />
  </div>
</div>
