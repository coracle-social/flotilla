<script lang="ts">
  import cx from "classnames"
  import {DAY, formatTimestampRelative, int, now} from "@welshman/lib"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Confetti from "@assets/icons/confetti.svg?dataurl"
  import Hourglass from "@assets/icons/hourglass.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import type {GoalProgress} from "@app/goals"

  type Props = {
    progress: GoalProgress
    class?: string
  }

  const {progress, ...props}: Props = $props()

  const endsSoon = $derived(
    Boolean(progress.closedAt && !progress.isEnded && progress.closedAt < now() + int(3, DAY)),
  )
</script>

{#if progress.isFunded}
  <span class={cx("badge badge-success badge-sm", props.class)}>
    <Icon icon={Confetti} size={4} />
    Funded
  </span>
{:else if progress.isEnded}
  <span class={cx("badge badge-neutral badge-sm", props.class)}>
    <Icon icon={Hourglass} size={4} />
    Ended
  </span>
{:else if progress.closedAt}
  <span class={cx("badge badge-sm", endsSoon ? "badge-warning" : "badge-neutral", props.class)}>
    <Icon icon={Hourglass} size={4} />
    Ends {formatTimestampRelative(progress.closedAt)}
  </span>
{:else}
  <span class={cx("badge badge-primary badge-sm", props.class)}>
    <Icon icon={Bolt} size={4} />
    Fundraising
  </span>
{/if}
