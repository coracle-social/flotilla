<script lang="ts">
  import {onMount, mount, unmount, createRawSnippet} from "svelte"
  import Drawer from "@lib/components/Drawer.svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import {modal, clearModals} from "@app/util/modal"

  const closeModals = () => {
    if ($modal && !$modal.options.noEscape) {
      clearModals()
    }
  }

  const onKeyDown = (e: any) => {
    if (e.code === "Escape" && e.target === document.body) {
      closeModals()
    }
  }

  let element: HTMLElement
  let instance: any | undefined

  onMount(() => {
    return modal.subscribe($modal => {
      if (instance) {
        unmount(instance, {outro: true})
        instance = undefined
      }

      if ($modal) {
        const {options, component, props} = $modal
        const wrapper = options.drawer ? Drawer : Dialog

        instance = mount(wrapper as any, {
          target: element,
          props: {
            onClose: closeModals,
            children: createRawSnippet(() => ({
              render: () => "<div></div>",
              setup: (target: Element) => {
                const child = mount(component, {target, props})

                return () => unmount(child)
              },
            })),
          },
        })
      }
    })
  })
</script>

<svelte:window onkeydown={onKeyDown} />

<div bind:this={element}></div>
