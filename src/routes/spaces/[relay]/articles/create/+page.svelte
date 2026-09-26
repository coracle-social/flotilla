<script lang="ts">
  import {page} from "$app/stores"
  import ArticleForm from "@app/components/ArticleForm.svelte"
  import {decodeRelay} from "@app/relays"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const url = decodeRelay(params.relay)
  const h = $page.url.searchParams.get("h") ?? undefined
  const shareToChat = $page.url.searchParams.has("shareToChat")
</script>

<ArticleForm {url} {h} {shareToChat}>
  {#snippet header()}
    <strong>Write an Article</strong>
  {/snippet}
</ArticleForm>
