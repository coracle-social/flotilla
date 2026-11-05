<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import PenNewSquare from "@assets/icons/pen-new-square.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import NoteCreate from "@app/components/NoteCreate.svelte"
  import PostCreateMenu from "@app/components/PostCreateMenu.svelte"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    class?: string
    buttonClass: string
    children?: Snippet
  }

  const {class: className = "", buttonClass, children}: Props = $props()

  const createPost = () => pushModal(NoteCreate)
</script>

<div class={cx("join", className)}>
  <Button aria-label="Create post" class={cx(buttonClass, "join-item grow")} onclick={createPost}>
    <Icon icon={PenNewSquare} size={4} />
    {@render children?.()}
  </Button>
  <MenuButton
    aria-label="Choose a post type"
    component={PostCreateMenu}
    componentProps={{includePost: false}}
    class={cx(buttonClass, "join-item")}>
    <Icon icon={AltArrowDown} size={4} />
  </MenuButton>
</div>
