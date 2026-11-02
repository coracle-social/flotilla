<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Highlight} from "@welshman/domain"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {reader} from "@app/core/domain"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const highlight = $derived(reader(Highlight)(props.event))
  const summary = $derived(highlight.comment() || props.event.content)
</script>

<ContentMinimal {...props} event={{...props.event, content: summary}} />
