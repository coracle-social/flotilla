<script lang="ts">
  type Props = {
    value: string
  }

  const {value}: Props = $props()
</script>

{#each value as _, i (i)}
  <br />
{/each}
