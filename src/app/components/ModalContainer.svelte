<script lang="ts">
  import {onMount, mount, unmount} from "svelte"
  import Drawer from "@lib/components/Drawer.svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import {modal, modalStack, popModal} from "@app/modal"

  const closeModal = () => {
    if ($modal && !$modal.options.noEscape) {
      popModal()
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target

    if (
      event.code === "Escape" &&
      target instanceof Element &&
      !target.closest("input, textarea, [contenteditable]")
    ) {
      closeModal()
    }
  }

  let element: HTMLElement
  const instances: Record<string, any> = {}

  onMount(() => {
    return modalStack.subscribe($modalStack => {
      const ids = $modalStack.map(({id}) => id)

      for (const [id, instance] of Object.entries(instances)) {
        if (!ids.includes(id)) {
          unmount(instance, {outro: true})
          delete instances[id]
        }
      }

      for (const item of $modalStack) {
        if (instances[item.id]) {
          continue
        }

        const {options, component, props} = item
        const wrapper = options.drawer ? Drawer : Dialog

        instances[item.id] = mount(wrapper as any, {
          target: element,
          props: {
            onClose: closeModal,
            size: options.size,
            noEscape: options.noEscape,
            fullscreen: options.fullscreen,
            children: {component, props},
          },
        })
      }
    })
  })
</script>

<svelte:window onkeydown={onKeyDown} />

<div bind:this={element} data-sveltekit-replacestate="true"></div>
