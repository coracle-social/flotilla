<script lang="ts">
  import {writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import type {Instance} from "tippy.js"
  import {remove, without, uniq} from "@welshman/lib"
  import {createSearch, topics} from "@welshman/app"
  import {normalizeTopic} from "@lib/util"
  import Suggestions from "@lib/components/Suggestions.svelte"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"
  import TopicSuggestion from "@app/components/TopicSuggestion.svelte"

  interface Props {
    value: string[]
    term?: Writable<string>
  }

  let {value = $bindable(), term = writable("")}: Props = $props()

  const topicSearch = $derived.by(() =>
    createSearch(without(value, $topics), {
      getValue: topic => topic.name,
      fuseOptions: {
        keys: ["name"],
        threshold: 0.4,
      },
    }),
  )

  const addTopic = (text: string) => {
    const topic = normalizeTopic(text)

    if (topic) {
      value = uniq([...value, topic])
    }

    term.set("")
    popover?.hide()
  }

  const removeTopic = (topic: string) => {
    value = remove(topic, value)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (instance?.onKeyDown(e)) {
      e.preventDefault()
      return
    }

    if (e.key === "Enter" && $term) {
      e.preventDefault()
      addTopic($term)
    }
  }

  const onBlur = () => {
    term.set("")
    popover?.hide()
  }

  let label: Element | undefined = $state()
  let popover: Instance | undefined = $state()
  let instance: any = $state()

  $effect(() => {
    if ($term.trim()) {
      popover?.show()
    } else {
      popover?.hide()
    }
  })
</script>

<div class="flex flex-col gap-2">
  <div class="flex flex-wrap gap-2">
    {#each value as topic (topic)}
      <div class="badge badge-neutral gap-1">
        <Button class="flex items-center" onclick={() => removeTopic(topic)}>
          <Icon icon={CloseCircle} size={4} class="-ml-1 mt-px" />
        </Button>
        <span>#{topic}</span>
      </div>
    {/each}
  </div>
  <label class="input input-bordered flex w-full items-center gap-2" bind:this={label}>
    <Icon icon={Magnifier} />
    <input
      bind:value={$term}
      class="grow"
      type="text"
      placeholder="Add topics..."
      onkeydown={onKeyDown}
      onblur={onBlur} />
  </label>
  <Tippy
    bind:popover
    bind:instance
    component={Suggestions}
    props={{
      term,
      search: topicSearch.searchValues,
      select: addTopic,
      component: TopicSuggestion,
      allowCreate: true,
    }}
    params={{
      trigger: "manual",
      interactive: true,
      placement: "bottom",
      getReferenceClientRect: () => label!.getBoundingClientRect(),
      onShow: (instance: Instance) => {
        instance.popper.style.width = `${label!.getBoundingClientRect().width + 8}px`
      },
    }} />
</div>
