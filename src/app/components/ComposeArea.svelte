<script module lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"

  export type ComposeValues = EventContent & {
    parent?: TrustedEvent
    share?: TrustedEvent
    edit?: TrustedEvent
  }
</script>

<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {page} from "$app/stores"
  import {ifLet} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import Compose from "@app/components/Compose.svelte"
  import ComposeEdit from "@app/components/ComposeEdit.svelte"
  import ComposeParent from "@app/components/ComposeParent.svelte"
  import {pendingShare, type Share} from "@app/share"

  type Props = Pick<
    ComponentProps<typeof Compose>,
    "url" | "h" | "draftKey" | "encryptFiles" | "disabled" | "emptyAction"
  > & {
    messages: TrustedEvent[]
    canEdit: (event: TrustedEvent) => boolean
    onSubmit: (values: ComposeValues) => Promise<void>
  }

  const {messages, canEdit, onSubmit, ...props}: Props = $props()

  export const reply = (event: TrustedEvent) => {
    parent = event
    compose?.focus()
  }

  export const edit = (event: TrustedEvent) => {
    clearParent()
    clearShare()
    eventToEdit = event
  }

  const clearParent = () => {
    parent = undefined
  }

  const clearShare = () => {
    share = undefined
  }

  const clearEventToEdit = () => {
    eventToEdit = undefined
  }

  const onEscape = () => {
    clearParent()
    clearShare()
    clearEventToEdit()
  }

  const onEditPrevious = () => ifLet(messages.find(canEdit), edit)

  const submit = async ({content, tags}: EventContent) => {
    // An edit that changes nothing is just a dismissal
    if (eventToEdit?.content === content) {
      clearEventToEdit()
    } else if (content || sharedEvent) {
      await onSubmit({content, tags, parent, share: sharedEvent, edit: eventToEdit})

      // Only once it's sent, so a failure leaves the reply or edit in place to try again.
      clearParent()
      clearShare()
      clearEventToEdit()
    }
  }

  let compose: Compose | undefined = $state()
  let parent: Maybe<TrustedEvent> = $state()
  let share: Maybe<Share> = $state()
  let eventToEdit: Maybe<TrustedEvent> = $state()

  const sharedEvent = $derived(share?.type === "event" ? share.value : undefined)

  const initialValues = $derived.by((): Maybe<Share> => {
    if (eventToEdit) {
      return {type: "text", value: eventToEdit.content}
    }

    if (share) {
      return share
    }
  })

  // Only the conversation a share was sent to takes it, including the one already on screen.
  $effect(() => {
    if ($pendingShare?.path === $page.url.pathname) {
      share = $pendingShare.share
      pendingShare.set(undefined)
    }
  })
</script>

<div class="flex flex-col gap-px">
  {#if parent}
    <ComposeParent url={props.url} event={parent} clear={clearParent} verb="Replying to" />
  {/if}
  {#if sharedEvent}
    <ComposeParent url={props.url} event={sharedEvent} clear={clearShare} verb="Sharing" />
  {/if}
  {#if eventToEdit}
    <ComposeEdit clear={clearEventToEdit} />
  {/if}
</div>
{#key initialValues}
  <Compose
    {...props}
    {initialValues}
    {onEscape}
    {onEditPrevious}
    onSubmit={submit}
    bind:this={compose} />
{/key}
