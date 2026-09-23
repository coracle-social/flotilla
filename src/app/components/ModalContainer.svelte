<script lang="ts">
  import type {Component, ComponentProps} from "svelte"
  import {mount, unmount, untrack} from "svelte"
  import {beforeNavigate} from "$app/navigation"
  import Drawer from "@lib/components/Drawer.svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import {getModal, getModalStack, navigate, popModal} from "@app/modal"

  // A link inside a modal is SvelteKit's to handle, and it would stack the page it opens on
  // top of the modal's own history entry. Hand it to `navigate`, which gives that entry back
  // first.
  beforeNavigate(navigation => {
    if (navigation.type === "link" && navigation.to && getModalStack().length > 0) {
      navigation.cancel()
      navigate(navigation.to.url.href)
    }
  })

  const closeModal = () => {
    const modal = getModal()

    if (modal && !modal.options.noEscape) {
      popModal()
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target

    if (
      !event.defaultPrevented &&
      event.code === "Escape" &&
      target instanceof Element &&
      !target.closest("input, textarea, [contenteditable]")
    ) {
      closeModal()
    }
  }

  let element: HTMLElement
  type WrapperProps = ComponentProps<typeof Dialog>

  const instances: Record<string, {instance: ReturnType<typeof mount>; props: WrapperProps}> = {}

  $effect(() => {
    const stack = getModalStack()

    untrack(() => {
      const ids = stack.map(({id}) => id)
      const activeId = ids.at(-1)

      for (const [id, {instance, props}] of Object.entries(instances)) {
        props.active = id === activeId

        if (!ids.includes(id)) {
          props.restoreFocus = !activeId || Boolean(instances[activeId])
          unmount(instance, {outro: true})
          delete instances[id]
        }
      }

      for (const item of stack) {
        if (instances[item.id]) {
          continue
        }

        const {options, component, props} = item
        const wrapper = options.drawer ? Drawer : Dialog
        const wrapperProps = $state({
          active: item.id === activeId,
          onClose: closeModal,
          label: options.label,
          restoreFocus: true,
          size: options.size,
          noEscape: options.noEscape,
          fullscreen: options.fullscreen,
          children: {component, props},
        })

        instances[item.id] = {
          instance: mount(wrapper as Component, {
            target: element,
            props: wrapperProps,
          }),
          props: wrapperProps,
        }
      }
    })
  })
</script>

<svelte:window onkeydown={onKeyDown} />

<div bind:this={element}></div>
