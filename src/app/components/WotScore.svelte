<style>
  .wot-background {
    fill: transparent;
    stroke: var(--base-content);
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
  import {pubkey, getFollows, deriveUserWotScore} from "@welshman/app"

  interface Props {
    pubkey: string
  }

  const {pubkey: target}: Props = $props()

  const max = 100
  const radius = 6
  const center = radius + 1

  const score = deriveUserWotScore(target)
  const active = $derived(getFollows($pubkey!).includes(target))
  const normalizedScore = $derived(clamp([0, max], $score) / max)
  const dashOffset = $derived(100 - 44 * normalizedScore)
  const style = $derived(`transform: rotate(${135 - normalizedScore * 180}deg)`)
  const stroke = $derived(active ? "var(--primary)" : "var(--base-content)")
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
