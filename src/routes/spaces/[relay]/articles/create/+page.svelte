<script lang="ts">
  import {page} from "$app/state"
  import ArticleForm from "@app/components/ArticleForm.svelte"
  import * as pages from "@app/navigation/pages"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {url, h, shareToChat} = pages.articleCreate.decode(params, page.url.searchParams)
</script>

<ArticleForm {url} {h} {shareToChat}>
  {#snippet header()}
    <strong>Write an Article</strong>
  {/snippet}
</ArticleForm>
