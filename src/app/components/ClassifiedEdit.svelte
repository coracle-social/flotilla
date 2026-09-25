<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {Classified} from "@welshman/domain"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import {reader} from "@app/core"
  import ClassifiedForm from "@app/components/ClassifiedForm.svelte"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const classified = $derived(reader(Classified)(event))

  const initialValues = $derived(
    classified && {
      d: classified.identifier() ?? "",
      title: classified.title() ?? "",
      status: classified.status() ?? "",
      content: classified.content(),
      price: classified.price()?.amount ?? 0,
      currency: classified.price()?.currency ?? "SAT",
      images: classified.images(),
      topics: classified.topics(),
    },
  )
</script>

{#if initialValues}
  <ClassifiedForm {url} h={classified.room()} {initialValues}>
    {#snippet header()}
      <ModalHeader>
        <ModalTitle>Edit this Listing</ModalTitle>
        <ModalSubtitle>Advertise a job, sale, or need.</ModalSubtitle>
      </ModalHeader>
    {/snippet}
  </ClassifiedForm>
{/if}
