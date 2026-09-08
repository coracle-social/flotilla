<script lang="ts">
  import type {Component} from "svelte"
  import {fade} from "@lib/transition"

  type Props = {
    onClose?: any
    children: {
      component: Component
      props: Record<string, any>
    }
  }

  const {onClose, children}: Props = $props()
</script>

<div
  class="drawer fixed inset-x-0 top-0 z-modal bottom-[calc(var(--mobile-nav-height)+var(--saib))] md:bottom-0">
  <button
    aria-label="Close drawer"
    class="absolute inset-0 cursor-pointer bg-black opacity-50"
    transition:fade
    onclick={onClose}>
  </button>
  <div
    class="pt-sai pl-sai border-line absolute bottom-0 left-0 top-0 flex w-full overflow-hidden border-r border-solid shadow-xl md:w-80 md:pb-sai lg:w-96">
    <children.component {...children.props} />
  </div>
</div>
