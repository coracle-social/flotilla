<script lang="ts">
  import {parse, renderAsHtml} from "@welshman/content"
  import {fly} from "@lib/transition"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {toast, popToast} from "@app/util/toast"

  const onActionClick = () => {
    $toast!.action!.onclick()
    popToast($toast!.id)
  }
</script>

{#if $toast}
  {@const theme = $toast.theme || "info"}
  <div transition:fly class="bottom-sai right-sai toast z-toast">
    {#key $toast.id}
      <div
        role="alert"
        class="alert flex justify-center whitespace-normal text-left"
        class:bg-base-100={theme === "info"}
        class:text-base-content={theme === "info"}
        class:alert-error={theme === "error"}>
        <p class:welshman-content-error={theme === "error"}>
          {#if $toast.message}
            {@html renderAsHtml(parse({content: $toast.message}))}
            {#if $toast.action}
              <Button class="cursor-pointer underline" onclick={onActionClick}>
                {$toast.action.message}
              </Button>
            {/if}
          {:else if $toast.children}
            {@const {component: Component, props} = $toast?.children || {}}
            <Component toast={$toast} {...props} />
          {/if}
        </p>
        <Button class="flex items-center opacity-75" onclick={() => popToast($toast.id)}>
          <Icon icon={CloseCircle} />
        </Button>
      </div>
    {/key}
  </div>
{/if}
