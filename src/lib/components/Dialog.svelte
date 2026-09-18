<script module lang="ts">
  export type DialogSize = "default" | "large"
</script>

<script lang="ts" generics="ChildrenProps extends Record<string, unknown>">
  import type {Component} from "svelte"
  import {onMount, setContext} from "svelte"
  import cx from "classnames"
  import {createFocusTrap} from "focus-trap"
  import type {FocusTrap} from "focus-trap"
  import {noop} from "@welshman/lib"
  import {fade, fly} from "@lib/transition"
  import Close from "@assets/icons/close.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {DIALOG_CONTEXT} from "@lib/components/dialog"

  type Props = {
    onClose?: () => void
    active?: boolean
    label?: string
    restoreFocus?: boolean
    noEscape?: boolean
    fullscreen?: boolean
    size?: DialogSize
    children: {
      component: Component<ChildrenProps>
      props: ChildrenProps
    }
  }

  const {
    onClose = noop,
    active = true,
    label = undefined,
    restoreFocus = true,
    noEscape = false,
    fullscreen = false,
    size = "default",
    children,
  }: Props = $props()

  const wrapperClass = $derived(
    cx("absolute inset-0 flex sm:relative pointer-events-none", {
      "items-center justify-center": fullscreen,
      "items-end sm:items-center": !fullscreen,
      "sm:w-[520px]": !fullscreen && size === "default",
      "sm:w-[90%]": !fullscreen && size === "large",
    }),
  )

  const innerClass = $derived(
    cx("dialog relative text-content grow pointer-events-auto", "rounded-t-2xl sm:rounded-3xl", {
      "bg-surface max-h-[90vh] flex flex-col max-w-full pb-sai sm:pb-0": !fullscreen,
    }),
  )

  const buttonClass = $derived(
    cx("absolute right-3 z-tooltip", {
      "top-3": fullscreen,
      "-top-4 mr-sai": !fullscreen,
    }),
  )

  let titleId = $state<string | undefined>()
  let contentLabel = $state<string | undefined>()
  let element: HTMLElement
  let panel: HTMLElement
  let trap: FocusTrap | undefined

  setContext(DIALOG_CONTEXT, {
    registerLabel: (value: string) => {
      contentLabel = value

      return () => {
        if (contentLabel === value) {
          contentLabel = undefined
        }
      }
    },
    registerTitle: (id: string) => {
      titleId = id

      return () => {
        if (titleId === id) {
          titleId = undefined
        }
      }
    },
  })

  $effect(() => {
    if (trap) {
      if (active) {
        if (trap.active) {
          trap.unpause()
        } else {
          trap.activate()
        }
      } else if (trap.active && !trap.paused) {
        trap.pause()
      }
    }
  })

  onMount(() => {
    const overlay = element
    const autofocus = panel.querySelector<HTMLElement>("[autofocus]")

    const holdsFocus = () => {
      const {activeElement} = document

      return !activeElement || activeElement === document.body || overlay.contains(activeElement)
    }

    trap = createFocusTrap(element, {
      allowOutsideClick: true,
      escapeDeactivates: false,
      fallbackFocus: panel,
      ...(autofocus ? {initialFocus: autofocus} : {}),
      isolateSubtrees: false,
      returnFocusOnDeactivate: false,
      setReturnFocus: previous => (previous.isConnected && holdsFocus() ? previous : false),
      tabbableOptions: {getShadowRoot: true},
    })

    if (active) {
      trap.activate()
    }

    return () => {
      trap?.deactivate({returnFocus: restoreFocus})
    }
  })
</script>

<div
  bind:this={element}
  class="dialog dialog-overlay flex justify-center items-center fixed inset-0 z-modal"
  inert={!active}>
  <button
    type="button"
    tabindex="-1"
    aria-hidden="true"
    class="absolute inset-0 cursor-pointer bg-black opacity-50 dark:opacity-75"
    transition:fade={{duration: 200}}
    onclick={onClose}>
  </button>
  <div class={wrapperClass}>
    <div
      bind:this={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={titleId ? undefined : contentLabel || label}
      tabindex="-1"
      class={innerClass}
      style={!fullscreen ? "box-shadow: var(--shadow-lg)" : undefined}
      transition:fly>
      <children.component {...children.props} />
      {#if !noEscape}
        <Button
          aria-label="Close dialog"
          class={cx("button button-neutral button-sm button-circle", buttonClass)}
          onclick={onClose}>
          <Icon icon={Close} size={6} />
        </Button>
      {/if}
    </div>
  </div>
  <div class="tippy-target dialog-tippy-target"></div>
</div>
