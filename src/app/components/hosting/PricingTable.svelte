<script lang="ts">
  import cx from "classnames"
  import Check from "@assets/icons/check.svg?dataurl"
  import Close from "@assets/icons/close.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import type {Plan} from "@app/hosting"

  type Props = {
    plans: Plan[]
    selectable?: boolean
    value?: string
    onSelect?: (planId: string) => void
    onCta?: (planId: string) => void
  }

  const {plans, selectable = false, value, onSelect, onCta}: Props = $props()

  const priceLabel = (amount: number) => (amount === 0 ? "Free" : `$${amount / 100}`)

  const memberLabel = (members: Plan["members"]) =>
    members ? `Up to ${members} members` : "Unlimited members"

  const visiblePlans = $derived(plans.filter(plan => !plan.hidden))

  const gridCols: Record<number, string> = {
    1: "",
    2: "@md:grid-cols-2",
    3: "@md:grid-cols-2 @3xl:grid-cols-3",
    4: "@md:grid-cols-2 @3xl:grid-cols-4",
  }

  const cardCount = $derived(visiblePlans.length + (selectable ? 0 : 1))
</script>

{#snippet feature(present: boolean, label: string)}
  <li class={cx("flex items-start gap-2", {"text-content-subtle": !present})}>
    <Icon
      icon={present ? Check : Close}
      size={4}
      class={cx("mt-0.5 shrink-0", {"text-primary": present})} />
    {label}
  </li>
{/snippet}

{#snippet cardBody(plan: Plan, isPopular: boolean)}
  {#if isPopular && !selectable}
    <span
      class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold tracking-wide text-primary-content">
      POPULAR
    </span>
  {/if}
  <h3 class="mb-1 text-lg font-bold">{plan.name}</h3>
  <div class="mb-8">
    <span class="text-4xl font-extrabold">{priceLabel(plan.amount)}</span>
    <span class="ml-1 text-sm text-content-muted">/ mo</span>
  </div>
  <ul class="mb-8 flex flex-col gap-3 text-sm">
    <li class="flex items-start gap-2">
      <Icon icon={Check} size={4} class="mt-0.5 shrink-0 text-primary" />
      {memberLabel(plan.members)}
    </li>
    {@render feature(plan.blossom, "Media storage")}
    {@render feature(plan.livekit, "Video calls")}
  </ul>
  {#if !selectable}
    <Button
      class={cx("button button-block mt-auto", {
        "button-primary": isPopular,
        "button-neutral": !isPopular,
      })}
      onclick={() => onCta?.(plan.id)}>
      Get started
    </Button>
  {/if}
{/snippet}

<div class="@container">
  <div class={cx("grid grid-cols-1 items-start gap-6", gridCols[cardCount] ?? "@3xl:grid-cols-4")}>
    {#each visiblePlans as plan (plan.id)}
      {@const isPopular = plan.id === "basic"}
      {#if selectable}
        <Button
          class={cx("card card-interactive relative flex flex-col text-left", {
            "border-primary": value === plan.id,
          })}
          onclick={() => onSelect?.(plan.id)}>
          {@render cardBody(plan, isPopular)}
        </Button>
      {:else}
        <div class={cx("card relative flex flex-col", {"border-primary": isPopular})}>
          {@render cardBody(plan, isPopular)}
        </div>
      {/if}
    {/each}
    {#if !selectable}
      <div class="card relative flex flex-col">
        <h3 class="mb-1 text-lg font-bold">Custom</h3>
        <div class="mb-8">
          <span class="text-4xl font-extrabold">Let's talk</span>
        </div>
        <ul class="mb-8 flex flex-col gap-3 text-sm">
          <li class="flex items-start gap-2">
            <Icon icon={Check} size={4} class="mt-0.5 shrink-0 text-primary" />
            White-labeled app
          </li>
          <li class="flex items-start gap-2">
            <Icon icon={Check} size={4} class="mt-0.5 shrink-0 text-primary" />
            Dedicated support
          </li>
          <li class="flex items-start gap-2">
            <Icon icon={Check} size={4} class="mt-0.5 shrink-0 text-primary" />
            Custom feature development
          </li>
        </ul>
        <Link
          external
          href="https://cal.com/coracle.social/30min"
          class="button button-neutral button-block mt-auto text-center">
          Contact us
        </Link>
      </div>
    {/if}
  </div>
</div>
