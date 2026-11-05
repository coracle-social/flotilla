<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"
  import Clock from "@assets/icons/clock-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ScheduleDialog from "@app/components/ScheduleDialog.svelte"
  import {pushModal} from "@app/navigation/dialogs"

  type Props = {
    onPublish: (scheduleAt?: number) => unknown
    disabled?: boolean
    class?: string
    "data-tip"?: string
    children: Snippet
  }

  const {onPublish, disabled, class: className, "data-tip": tip, children}: Props = $props()

  // The click event must not reach onPublish, where it would read as a schedule time.
  const publish = () => onPublish()

  const schedule = () => pushModal(ScheduleDialog, {onPick: onPublish}, {nested: true})
</script>

<div class="join">
  <Button
    data-tip={tip}
    class={cx("button button-primary join-item", className, {"tip tip-left": tip})}
    {disabled}
    onclick={publish}>
    {@render children()}
  </Button>
  <Button
    data-tip="Schedule for later"
    aria-label="Schedule for later"
    class={cx("button button-primary tip tip-left join-item", className)}
    {disabled}
    onclick={schedule}>
    <Icon icon={Clock} size={4} />
  </Button>
</div>
