<script lang="ts">
  import PenNewSquare from "@assets/icons/pen-new-square.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import FAB from "@lib/components/FAB.svelte"
  import PostCreateMenu from "@app/components/PostCreateMenu.svelte"
</script>

<FAB aria-label="Create post" menu={PostCreateMenu}>
  <Icon icon={PenNewSquare} size={7} />
</FAB>
