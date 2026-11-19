<script lang="ts">
  import LogInOptions from "@app/components/LogInOptions.svelte"

  type Props = {
    title: string
    message: string
  }

  const {title, message}: Props = $props()
</script>

<div class="py-20">
  <div class="card m-auto flex max-w-md flex-col gap-6">
    <div class="flex flex-col gap-2 text-center">
      <strong class="text-lg">{title}</strong>
      <p class="opacity-75">{message}</p>
    </div>
    <LogInOptions />
  </div>
</div>
