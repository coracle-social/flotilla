<script lang="ts">
  type Props = {
    value: string
  }

  const {value}: Props = $props()
</script>

<span>#{value}</span>
