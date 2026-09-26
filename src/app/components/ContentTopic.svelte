<script lang="ts">
  type Props = {
    value: string
  }

  const {value}: Props = $props()
</script>

<span class="link-content">
  #{value}
</span>
