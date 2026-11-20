<script lang="ts">
  import {page} from "$app/state"
  import ArticleForm from "@app/components/ArticleForm.svelte"
  import LogInGate from "@app/components/LogInGate.svelte"
  import * as pages from "@app/navigation/pages"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {url, h, shareToChat} = pages.articleCreate.decode(params, page.url.searchParams)
</script>

<LogInGate title="Log in to write an article" message="Articles are published under your name.">
  <ArticleForm {url} {h} {shareToChat}>
    {#snippet header()}
      <strong>Write an Article</strong>
    {/snippet}
  </ArticleForm>
</LogInGate>
