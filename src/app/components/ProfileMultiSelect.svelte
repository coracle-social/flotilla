<script lang="ts">
  import {writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import {type Instance} from "tippy.js"
  import {append, remove, uniq} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import {decodePubkey} from "@lib/util"
  import Suggestions from "@lib/components/Suggestions.svelte"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import ProfileSuggestion from "@app/editor/ProfileSuggestion.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import {profiles} from "@app/core"
  import {pushModal} from "@app/modal"

  type Props = {
    value: string[]
    autofocus?: boolean
    term?: Writable<string>
  }

  let {value = $bindable(), term = writable(""), autofocus = false}: Props = $props()

  const profileSearch = $profiles.profileSearch

  const search = (term: string) => $profileSearch.searchValues(term)

  const selectPubkey = (pubkey: string) => {
    term.set("")
    tippy?.hide()
    value = uniq(append(pubkey, value))
  }

  const removePubkey = (pubkey: string) => {
    value = remove(pubkey, value)
  }

  const onInput = (e: any) => {
    const pubkey = decodePubkey(e.target.value)

    if (pubkey) {
      selectPubkey(pubkey)
    }
  }

  const onKeyDown = (e: Event) => {
    if (tippy?.content?.onKeyDown(e)) {
      e.preventDefault()
    }
  }

  let label: Element | undefined = $state()
  let tippy: Maybe<TippyController> = $state()

  $effect(() => {
    // @ts-ignore
    oninput?.($term)

    if ($term) {
      tippy?.show()
    } else {
      tippy?.hide()
    }
  })
</script>

<div class="flex flex-col gap-1">
  <div>
    {#each value as pubkey (pubkey)}
      {@const onClick = () => pushModal(ProfileDetail, {pubkey})}
      <Badge variant="neutral" class="mr-1 mb-1 gap-1">
        <Button class="flex items-center" onclick={() => removePubkey(pubkey)}>
          <Icon icon={CloseCircle} size={4} />
        </Button>
        <Button onclick={onClick}>
          <ProfileName {pubkey} />
        </Button>
      </Badge>
    {/each}
  </div>
  <label class="input flex w-full items-center gap-2" bind:this={label}>
    <Icon icon={Magnifier} />
    <!-- svelte-ignore a11y_autofocus -->
    <input
      {autofocus}
      class="grow"
      type="text"
      placeholder="Search for profiles..."
      bind:value={$term}
      oninput={onInput}
      onkeydown={onKeyDown} />
  </label>
  <Tippy
    bind:controller={tippy}
    component={Suggestions}
    props={{
      term,
      search,
      select: selectPubkey,
      component: ProfileSuggestion,
      class: "rounded-2xl",
      style: `left: 4px; width: ${label?.clientWidth + 12}px`,
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
