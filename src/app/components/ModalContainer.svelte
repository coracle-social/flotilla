<script lang="ts">
  import type {Component, ComponentProps} from "svelte"
  import {mount, unmount, untrack} from "svelte"
  import {beforeNavigate} from "$app/navigation"
  import Drawer from "@lib/components/Drawer.svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import NoteDetail from "@app/components/NoteDetail.svelte"
  import {getModal, getModalStack, popModal} from "@app/navigation/dialogs"
  import type {Modal} from "@app/navigation/dialogs"
  import {navigate} from "@app/navigation/navigate"
  import {closeNote, getNoteOverlay} from "@app/navigation/overlays"

  // SvelteKit would stack the page a link opens on top of the modal's own history entry.
  beforeNavigate(navigation => {
    if (navigation.type === "link" && navigation.to && getModalStack().length > 0) {
      navigation.cancel()
      navigate(navigation.to.url.href)
    }
  })

  // The note in the url sits beneath any dialogs opened over it.
  const getLayers = (): Pick<Modal, "id" | "component" | "props" | "options">[] => {
    const note = getNoteOverlay()
    const dialogs = getModalStack()

    return note
      ? [
          {
            id: `note:${note.ref.getIdOrAddress()}`,
            component: NoteDetail,
            props: note,
            options: {size: "large"},
          },
          ...dialogs,
        ]
      : dialogs
  }

  const closeModal = () => {
    const modal = getModal()

    if (modal) {
      if (!modal.options.noEscape) {
        popModal()
      }
    } else if (getNoteOverlay()) {
      closeNote()
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

  type WrapperState = {active: boolean; restoreFocus: boolean}

  const instances: Record<string, {instance: ReturnType<typeof mount>; state: WrapperState}> = {}

  $effect(() => {
    const stack = getLayers()

    untrack(() => {
      const ids = stack.map(({id}) => id)
      const activeId = ids.at(-1)

      for (const [id, {instance, state}] of Object.entries(instances)) {
        state.active = id === activeId

        if (!ids.includes(id)) {
          state.restoreFocus = !activeId || Boolean(instances[activeId])
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
        // Only the two props this container changes are reactive, so nothing proxies a modal's own.
        const state = $state({active: item.id === activeId, restoreFocus: true})
        const wrapperProps: WrapperProps = {
          get active() {
            return state.active
          },
          get restoreFocus() {
            return state.restoreFocus
          },
          onClose: closeModal,
          label: options.label,
          size: options.size,
          noEscape: options.noEscape,
          fullscreen: options.fullscreen,
          children: {component, props},
        }

        instances[item.id] = {
          instance: mount(wrapper as Component, {
            target: element,
            props: wrapperProps,
          }),
          state,
        }
      }
    })
  })
</script>

<svelte:window onkeydown={onKeyDown} />

<div bind:this={element}></div>
