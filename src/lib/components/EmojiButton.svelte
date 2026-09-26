<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Props as TippyProps} from "tippy.js"
  import type {Maybe} from "@welshman/lib"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"

  type Props = {
    tippyParams?: Partial<TippyProps>
    onEmoji: (emoji: string) => void
    allowKaomoji?: boolean
    class?: string
    children?: Snippet
    [key: string]: unknown
  }

  const {
    tippyParams = {},
    onEmoji,
    allowKaomoji = false,
    class: className,
    children,
    ...restProps
  }: Props = $props()

  const open = () => tippy?.show()

  const onClick = (emoji: string) => {
    onEmoji(emoji)
    tippy?.hide()
  }

  let tippy: Maybe<TippyController> = $state()
</script>

<Button onclick={open} class={className} {...restProps}>
  <Tippy
    bind:controller={tippy}
    class="flex"
    component={EmojiPicker}
    strayMargin={allowKaomoji ? undefined : 100}
    props={{onClick, allowKaomoji}}
    params={{trigger: "manual", interactive: true, ...tippyParams}}>
    {@render children?.()}
  </Tippy>
</Button>
