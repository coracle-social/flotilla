<script lang="ts">
  import {writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import type {Instance} from "tippy.js"
  import {remove, reject, spec, uniq} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import {Topics, createSearch} from "@welshman/app"
  import {normalizeTopic} from "@lib/util"
  import Suggestions from "@lib/components/Suggestions.svelte"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"
  import TopicSuggestion from "@app/components/TopicSuggestion.svelte"
  import {app} from "@app/core"

  type Props = {
    value: string[]
    term?: Writable<string>
  }

  let {value = $bindable(), term = writable("")}: Props = $props()

  const topics = $app.use(Topics).all.$

  const topicSearch = $derived.by(() =>
    createSearch(reject(spec({name: value}), $topics), {
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
    tippy?.hide()
  }

  const removeTopic = (topic: string) => {
    value = remove(topic, value)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (tippy?.content?.onKeyDown(e)) {
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
    tippy?.hide()
  }

  let label: Element | undefined = $state()
  let tippy: Maybe<TippyController> = $state()

  $effect(() => {
    if ($term.trim()) {
      tippy?.show()
    } else {
      tippy?.hide()
    }
  })
</script>

<div class="flex flex-col gap-2">
  <div>
    {#each value as topic (topic)}
      <div class="flex-inline badge badge-neutral mr-1 gap-1">
        <Button class="flex items-center" onclick={() => removeTopic(topic)}>
          <Icon icon={CloseCircle} size={4} class="mt-px" />
        </Button>
        <span>#{topic}</span>
      </div>
    {/each}
  </div>
  <label class="input flex w-full items-center gap-2" bind:this={label}>
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
    bind:controller={tippy}
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
