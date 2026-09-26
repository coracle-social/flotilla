<script lang="ts">
  import cx from "classnames"
  import {writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import type {Instance} from "tippy.js"
  import {spec} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import {createSearch} from "@welshman/app"
  import {currencyOptions, displayCurrency} from "@lib/currency"
  import Suggestions from "@lib/components/Suggestions.svelte"
  import CurrencySuggestion from "@app/components/CurrencySuggestion.svelte"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"

  type Props = {
    value: string
    autofocus?: boolean
    term?: Writable<string>
    class?: string
  }

  let {value = $bindable(), term = writable(""), autofocus = false, ...props}: Props = $props()

  const options = createSearch(currencyOptions, {
    getValue: item => item.code,
    fuseOptions: {
      keys: ["name", "code"],
      threshold: 0.4,
    },
  })

  const search = (term: string) =>
    term ? options.searchValues(term) : ["BTC", "SAT", "USD", "GBP", "AUD", "CAD"]

  const selectCurrency = (code: string) => {
    value = code
    term.set("")
    tippy?.hide()
  }

  const clearAndFocus = () => {
    value = ""
    term.set("")
    setTimeout(() => wrapper?.querySelector("input")?.focus())
  }

  const onKeyDown = (e: Event) => {
    if (tippy?.content?.onKeyDown(e)) {
      e.preventDefault()
    }
  }

  const currency = $derived(currencyOptions.find(spec({code: value})))

  let wrapper: Element | undefined = $state()
  let tippy: Maybe<TippyController> = $state()

  $effect(() => {
    if ($term) {
      tippy?.show()
    } else {
      tippy?.hide()
    }
  })
</script>

<button
  class={cx(props.class, {"bg-surface": currency}, "input flex items-center gap-2 cursor-pointer")}
  bind:this={wrapper}
  onfocus={preventDefault(clearAndFocus)}
  onclick={preventDefault(clearAndFocus)}>
  <Icon icon={AltArrowDown} />
  {#if currency}
    <span class="min-w-0 truncate text-sm whitespace-nowrap">
      {displayCurrency(currency)}
    </span>
  {:else}
    <!-- svelte-ignore a11y_autofocus -->
    <input {autofocus} class="grow" type="text" bind:value={$term} onkeydown={onKeyDown} />
  {/if}
  <Tippy
    bind:controller={tippy}
    component={Suggestions}
    props={{
      term,
      search,
      select: selectCurrency,
      component: CurrencySuggestion,
    }}
    params={{
      trigger: "manual",
      interactive: true,
      placement: "bottom",
      getReferenceClientRect: () => wrapper!.getBoundingClientRect(),
      onShow: (instance: Instance) => {
        instance.popper.style.width = `${wrapper!.getBoundingClientRect().width + 8}px`
      },
    }} />
</button>
