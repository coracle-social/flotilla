<script lang="ts">
  import {now, randomId, removeUndefined} from "@welshman/lib"
  import {Poll} from "@welshman/domain"
  import type {PollType} from "@welshman/domain"
  import {isMobile, preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import HamburgerMenu from "@assets/icons/hamburger-menu.svg?dataurl"
  import PlusCircle from "@assets/icons/add-circle.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import DateTimeInput from "@lib/components/DateTimeInput.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import DragList from "@lib/components/DragList.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import {writer} from "@app/core"
  import {pushToast} from "@app/toast"
  import {publishToSpace} from "@app/rooms"
  import {DraftKey} from "@app/drafts"

  type Option = {
    id: string
    value: string
  }

  type Values = {
    title: string
    pollType: PollType
    endsAt?: number
    options: Option[]
  }

  type Props = {
    url: string
    h?: string
    shareToChat?: boolean
  }

  const {url, h, shareToChat = false}: Props = $props()
  const draftKey = new DraftKey<Values>(`poll:${url}:${h ?? ""}`)
  const initialValues = draftKey.get()

  const back = () => history.back()

  const addOption = () => {
    options = [...options, {id: randomId(), value: ""}]
  }

  const removeOption = (id: string) => () => {
    options = options.filter(option => option.id !== id)
  }

  const updateOption = (id: string) => (e: Event & {currentTarget: HTMLInputElement}) => {
    const {value} = e.currentTarget

    options = options.map(option => (option.id === id ? {...option, value} : option))
  }

  const reorderOptions = (newOptions: Option[]) => {
    options = newOptions
  }

  const submit = async () => {
    if (loading) {
      return
    }

    if (!title.trim()) {
      return pushToast({theme: "error", message: "Please provide a title for your poll."})
    }

    const nonEmptyOptions = removeUndefined(options.map(option => option.value.trim() || undefined))

    if (nonEmptyOptions.length < 2) {
      return pushToast({theme: "error", message: "Please provide at least two options."})
    }

    if (endsAt && endsAt <= now()) {
      return pushToast({theme: "error", message: "End time must be in the future."})
    }

    loading = true

    try {
      const eventWriter = writer(Poll).setTitle(title.trim()).setPollType(pollType).setUrls([url])

      for (const option of nonEmptyOptions) {
        eventWriter.addOption(option)
      }

      if (endsAt) {
        eventWriter.setEndsAt(endsAt)
      }

      const {error} = await publishToSpace(eventWriter, {url, h, shareToChat})

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      history.back()
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to create your poll."})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)

  let title = $state(initialValues?.title ?? "")
  let pollType = $state<PollType>(initialValues?.pollType ?? "singlechoice")
  let endsAt = $state<number | undefined>(initialValues?.endsAt)
  let options = $state<Option[]>(
    initialValues?.options ?? [
      {id: randomId(), value: "Yes"},
      {id: randomId(), value: "No"},
    ],
  )

  $effect(() => {
    draftKey.set({title, pollType, endsAt, options})
  })
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Poll</ModalTitle>
      <ModalSubtitle>Ask a question and collect votes right in the feed.</ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-8 relative">
      <Field>
        {#snippet label()}
          <p>Question*</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <!-- svelte-ignore a11y_autofocus -->
            <input
              autofocus={!isMobile}
              bind:value={title}
              class="grow"
              type="text"
              placeholder="What would you like to ask?" />
          </label>
        {/snippet}
      </Field>

      <Field>
        {#snippet label()}
          <p>Options*</p>
        {/snippet}
        {#snippet input()}
          <div class="flex flex-col gap-2" role="list">
            <DragList
              class="contents"
              itemClass="flex items-center gap-2"
              itemRole="listitem"
              items={options}
              getKey={option => option.id}
              onReorder={reorderOptions}>
              {#snippet item(option)}
                <div class="cursor-move opacity-70" aria-label="Drag handle">
                  <Icon icon={HamburgerMenu} size={4} />
                </div>
                <label class="input flex w-full items-center gap-2">
                  <input
                    value={option.value}
                    class="grow"
                    type="text"
                    placeholder={`Option ${options.indexOf(option) + 1}`}
                    oninput={updateOption(option.id)} />
                </label>
                <Button class="button button-ghost button-sm" onclick={removeOption(option.id)}>
                  <Icon icon={MinusCircle} size={4} />
                </Button>
              {/snippet}
            </DragList>
            <Button class="button button-outline button-sm self-end" onclick={addOption}>
              <Icon icon={PlusCircle} size={4} />
              Add option
            </Button>
          </div>
        {/snippet}
      </Field>

      <div class="flex flex-col gap-2">
        <FieldInline>
          {#snippet label()}
            Poll type
          {/snippet}
          {#snippet input()}
            <select class="select input w-full max-w-xs" bind:value={pollType}>
              <option value="singlechoice">Single choice</option>
              <option value="multiplechoice">Multiple choice</option>
            </select>
          {/snippet}
        </FieldInline>
        <FieldInline>
          {#snippet label()}
            Ends at
          {/snippet}
          {#snippet input()}
            <DateTimeInput bind:value={endsAt} />
          {/snippet}
        </FieldInline>
      </div>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Create Poll</Spinner>
    </Button>
  </ModalFooter>
</Modal>
