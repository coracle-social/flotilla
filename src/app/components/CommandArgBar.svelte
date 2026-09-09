<script lang="ts">
  import cx from "classnames"
  import {Pubkey} from "@welshman/util"
  import type {CommandArg, CommandScopeTarget} from "@welshman/util"
  import {slide} from "@lib/transition"
  import Button from "@lib/components/Button.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {deriveValidCommands, describeCommandDraft} from "@app/commands"

  type Props = {
    target: CommandScopeTarget
    content: string
    insert: (token: string) => void
  }

  const {target, content, insert}: Props = $props()

  const available = deriveValidCommands(target)

  const draft = $derived(describeCommandDraft($available, content))

  // Without a qualifier an invocation reaches every executor whose trigger matches, so offer
  // the choice rather than picking one silently.
  const ambiguous = $derived((draft?.matches.length ?? 0) > 1 && !draft?.invocation.pubkey)

  const activeArg = $derived(draft?.args[draft.activeIndex])

  const choices = $derived.by(() => {
    if (activeArg?.type === "enum") return activeArg.choices
    if (activeArg?.type === "bool") return ["true", "false"]

    return []
  })

  // An argument the user has moved past that didn't parse. The one being typed is legitimately
  // incomplete, so flagging it would just blink red on every keystroke.
  const invalid = $derived(
    draft?.bindings.find((binding, i) => i < draft.activeIndex && !binding.value)?.arg,
  )

  const displayArg = (arg: CommandArg) => (arg.required ? `<${arg.name}>` : `[${arg.name}]`)

  const qualify = (pubkey: string) => insert(`@${new Pubkey(pubkey).toNpub()}`)
</script>

{#if draft}
  <div
    class="bg-surface-more border-t-line-less border-l-primary flex flex-col gap-1 border-t border-l-2 border-solid px-2 py-1 text-xs"
    transition:slide>
    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span class="font-mono">
        <span class="text-primary">/{draft.command.command()}</span>
        {#each draft.args as arg, i (arg.name)}
          <span
            class={cx("ml-1", {
              "text-error": arg === invalid,
              "text-primary font-bold": arg !== invalid && i === draft.activeIndex,
              "opacity-50": arg !== invalid && i !== draft.activeIndex,
            })}>
            {displayArg(arg)}
          </span>
        {/each}
      </span>
      {#if invalid}
        <span class="text-error">That doesn't look like a {invalid.type}</span>
      {:else}
        <span class="opacity-75">{activeArg?.label || draft.command.description()}</span>
      {/if}
    </div>
    {#if ambiguous}
      <div class="flex flex-wrap items-center gap-2">
        <span class="opacity-75">Several bots answer this — pick one:</span>
        {#each draft.matches as match (match.address())}
          <Button class="button button-xs button-neutral" onclick={() => qualify(match.author())}>
            @<ProfileName pubkey={match.author()} url={target.url} />
          </Button>
        {/each}
      </div>
    {:else if choices.length > 0}
      <div class="flex flex-wrap items-center gap-2">
        {#each choices as choice (choice)}
          <Button class="button button-xs button-neutral" onclick={() => insert(choice)}>
            {choice}
          </Button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
