<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import EventMenu from "@app/components/EventMenu.svelte"

  type Props = {
    noun: string
    event: TrustedEvent
    url?: string
    customActions?: Snippet
    class?: string
  }

  const {noun, event, url, customActions, class: className = ""}: Props = $props()
</script>

<MenuButton
  component={EventMenu}
  componentProps={{url, noun, event, customActions}}
  aria-label="{noun} actions"
  placement="top"
  iconSize={4}
  class={cx("button button-neutral button-xs", className)} />
