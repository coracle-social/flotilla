<script lang="ts">
  import cx from "classnames"
  import {writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import type {Instance} from "tippy.js"
  import {preventDefault} from "@lib/html"
  import {createSearch} from "@welshman/app"
  import {currencyOptions, displayCurrency} from "@lib/currency"
  import Suggestions from "@lib/components/Suggestions.svelte"
  import CurrencySuggestion from "@app/components/CurrencySuggestion.svelte"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"

  interface Props {
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
    popover?.hide()
  }

  const clearAndFocus = () => {
    value = ""
    term.set("")
    setTimeout(() => wrapper?.querySelector("input")?.focus())
  }

  const onKeyDown = (e: Event) => {
    if (instance.onKeyDown(e)) {
      e.preventDefault()
    }
  }

  const currency = $derived(currencyOptions.find(c => c.code === value))

  let wrapper: Element | undefined = $state()
  let popover: Instance | undefined = $state()
  let instance: any = $state()

  $effect(() => {
    if ($term) {
      popover?.show()
    } else {
      popover?.hide()
    }
  })
</script>

<button
  class={cx(
    props.class,
    {"bg-base-200": currency},
    "input input-bordered flex items-center gap-2 cursor-pointer",
  )}
  bind:this={wrapper}
  onfocus={preventDefault(clearAndFocus)}
  onclick={preventDefault(clearAndFocus)}>
  <Icon icon={AltArrowDown} />
  {#if currency}
    <span class="text-sm ellipsize whitespace-nowrap">
      {displayCurrency(currency)}
    </span>
  {:else}
    <!-- svelte-ignore a11y_autofocus -->
    <input {autofocus} class="grow" type="text" bind:value={$term} onkeydown={onKeyDown} />
  {/if}
  <Tippy
    bind:popover
    bind:instance
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
