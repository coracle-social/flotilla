<script lang="ts">
  import type {ComponentProps} from "svelte"
  import Content from "@app/components/Content.svelte"
  import CalendarEventDate from "@app/components/CalendarEventDate.svelte"
  import CalendarEventHeader from "@app/components/CalendarEventHeader.svelte"

  const props: ComponentProps<typeof Content> = $props()
</script>

<div class="flex items-start gap-4">
  <CalendarEventDate event={props.event} />
  <div class="flex flex-grow flex-col">
    <CalendarEventHeader event={props.event} />
    <div class="flex py-2 opacity-50">
      <div class="h-px flex-grow bg-base-content opacity-25"></div>
    </div>
    <Content {...props} />
  </div>
</div>
