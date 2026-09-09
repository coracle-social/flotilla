<script lang="ts">
  import {fade} from "svelte/transition"
  import AltArrowUp from "@assets/icons/alt-arrow-up.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  const {element}: {element?: Element} = $props()

  let scrolled = $state(false)

  const scrollToTop = () => element?.scrollTo({top: 0, behavior: "smooth"})

  $effect(() => {
    if (element) {
      const onScroll = () => {
        scrolled = element.scrollTop > 800
      }

      element.addEventListener("scroll", onScroll, {passive: true})
      onScroll()

      return () => element.removeEventListener("scroll", onScroll)
    }
  })
</script>

{#if scrolled}
  <div transition:fade class="absolute right-4 bottom-20 z-nav mb-sai md:bottom-4 md:mb-0">
    <Button
      aria-label="Scroll to top"
      class="button button-neutral button-circle shadow-xl"
      onclick={scrollToTop}>
      <Icon icon={AltArrowUp} />
    </Button>
  </div>
{/if}
