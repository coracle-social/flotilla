<script module lang="ts">
  import type {HostedRelay} from "@app/hosting"

  export type RelayFormValues = Pick<
    HostedRelay,
    "info_name" | "subdomain" | "info_icon" | "info_description" | "plan_id"
  >
</script>

<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Maybe} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Input from "@lib/components/Input.svelte"
  import IconInput from "@lib/components/IconInput.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import PricingTable from "@app/components/hosting/PricingTable.svelte"
  import {derivePlans} from "@app/hosting"
  import {HOSTING_RELAY_DOMAIN} from "@app/env"
  import {pushToast} from "@app/toast"
  import {resolveImageInput} from "@app/uploads"

  type Props = {
    mode: "create" | "edit"
    initialValues?: Partial<RelayFormValues>
    zooidDomain?: string
    submitLabel?: string
    header?: Snippet
    onSubmit: (values: RelayFormValues) => Promise<void> | void
  }

  const {
    mode,
    initialValues = {},
    zooidDomain = HOSTING_RELAY_DOMAIN,
    submitLabel,
    header,
    onSubmit,
  }: Props = $props()

  const compressOptions = {maxWidth: 128, maxHeight: 128}

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const plans = derivePlans()

  let loading = $state(false)
  let name = $state(initialValues.info_name ?? "")
  let subdomain = $state(initialValues.subdomain ?? "")
  let icon = $state(initialValues.info_icon ?? "")
  let imageFile = $state<File | undefined>()
  let imagePreview = $state(initialValues.info_icon ?? "")
  let description = $state(initialValues.info_description ?? "")
  let planId = $state(initialValues.plan_id ?? "free")

  const validateSubdomain = (subdomain: string): Maybe<string> => {
    if (subdomain.length === 0) {
      return "subdomain is required"
    }

    if (subdomain.length > 63) {
      return "subdomain must be 63 characters or fewer"
    }

    if (subdomain.startsWith("-") || subdomain.endsWith("-")) {
      return "subdomain cannot start or end with a hyphen"
    }

    if (["api", "admin"].includes(subdomain)) {
      return "subdomain is reserved"
    }

    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return "subdomain may only contain lowercase letters, numbers, and hyphens"
    }

    return undefined
  }

  const subdomainError = $derived(validateSubdomain(subdomain))

  const saveLabel = $derived(submitLabel ?? (mode === "create" ? "Create Space" : "Save Changes"))

  // In create mode the subdomain tracks the name.
  $effect(() => {
    if (mode === "create") {
      subdomain = slugify(name)
    }
  })

  const back = () => history.back()

  const selectPlan = (id: string) => {
    planId = id
  }

  const trySubmit = async () => {
    if (mode === "create" && !planId) {
      return pushToast({theme: "error", message: "Please select a plan"})
    }

    const error = validateSubdomain(subdomain)

    if (error) {
      return pushToast({theme: "error", message: error})
    }

    loading = true

    try {
      const resolvedIcon = await resolveImageInput(imageFile, imagePreview, compressOptions)

      icon = resolvedIcon ?? ""
      imagePreview = icon
      imageFile = undefined

      await onSubmit({
        plan_id: planId,
        info_name: name,
        subdomain,
        info_icon: icon,
        info_description: description,
      })
    } catch (e) {
      pushToast({
        theme: "error",
        message: e instanceof Error ? e.message : "Failed to save space",
      })
    } finally {
      loading = false
    }
  }
</script>

<Modal tag="form" onsubmit={preventDefault(trySubmit)}>
  <ModalBody>
    {#if header}
      {@render header()}
    {:else}
      <ModalHeader>
        <ModalTitle>{mode === "create" ? "New Space" : "Edit Space"}</ModalTitle>
        <ModalSubtitle>
          {#if mode === "create"}
            Configure your hosted space and choose a plan.
          {:else}
            Update your space's details.
          {/if}
        </ModalSubtitle>
      </ModalHeader>
    {/if}
    <div class="flex flex-col gap-8">
      <Field>
        {#snippet label()}
          <p>Name</p>
        {/snippet}
        {#snippet input()}
          <Input bind:value={name} type="text" placeholder="My Space" required />
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Subdomain</p>
        {/snippet}
        {#snippet input()}
          <Input bind:value={subdomain} type="text" placeholder="my-space" required>
            {#snippet after()}
              <span class="whitespace-nowrap text-sm opacity-50">.{zooidDomain}</span>
            {/snippet}
          </Input>
          {#if subdomain && subdomainError}
            <p class="text-sm text-error">{subdomainError}</p>
          {/if}
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Icon</p>
        {/snippet}
        {#snippet input()}
          <IconInput bind:file={imageFile} bind:preview={imagePreview} />
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Description</p>
        {/snippet}
        {#snippet input()}
          <textarea bind:value={description} class="textarea input w-full" rows="3"></textarea>
        {/snippet}
      </Field>
      {#if mode === "create"}
        <Field>
          {#snippet label()}
            <p>Plan</p>
          {/snippet}
          {#snippet input()}
            <PricingTable plans={$plans} selectable value={planId} onSelect={selectPlan} />
          {/snippet}
        </Field>
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>{saveLabel}</Spinner>
    </Button>
  </ModalFooter>
</Modal>
