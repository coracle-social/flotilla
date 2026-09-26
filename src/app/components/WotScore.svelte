<style>
  .wot-background {
    fill: transparent;
    stroke: var(--content);
    opacity: 30%;
  }

  .wot-highlight {
    fill: transparent;
    stroke-width: 1.5;
    stroke-dasharray: 100 100;
    transform-origin: center;
  }
</style>

<script lang="ts">
  import {clamp} from "@welshman/lib"
  import {WotScope} from "@welshman/app"
  import {followLists, user, wot} from "@app/core"

  type Props = {
    pubkey: string
  }

  const {pubkey: target}: Props = $props()

  const max = 100
  const radius = 6
  const center = radius + 1

  const score = $derived($wot.score(target, WotScope.Follows).$)
  const follows = $derived($followLists.one($user.pubkey))
  const active = $derived(($follows?.pubkeys() ?? []).includes(target))
  const normalizedScore = $derived(clamp([0, max], $score) / max)
  const dashOffset = $derived(100 - 44 * normalizedScore)
  const style = $derived(`transform: rotate(${135 - normalizedScore * 180}deg)`)
  const stroke = $derived(active ? "var(--primary)" : "var(--content)")
</script>

<div class="relative h-[14px] w-[14px]">
  <svg height="14" width="14" class="absolute">
    <circle class="wot-background" cx={center} cy={center} r={radius} />
    <circle
      cx={center}
      cy={center}
      r={radius}
      class="wot-highlight"
      stroke-dashoffset={dashOffset}
      {style}
      {stroke} />
  </svg>
</div>
