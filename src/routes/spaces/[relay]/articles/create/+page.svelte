<script lang="ts">
  import {page} from "$app/state"
  import ArticleForm from "@app/components/ArticleForm.svelte"
  import * as pages from "@app/navigation/pages"
  import type {PageProps} from "./$types"
  import {user} from "@app/core/user"
  import LogInPanel from "@app/components/LogInPanel.svelte"

  const {params}: PageProps = $props()

  const {url, h, shareToChat} = pages.articleCreate.decode(params, page.url.searchParams)
</script>

{#if $user}
  <ArticleForm {url} {h} {shareToChat}>
    {#snippet header()}
      <strong>Write an Article</strong>
    {/snippet}
  </ArticleForm>
{:else}
  <LogInPanel
    title="Log in to write an article"
    message="Articles are published under your name." />
{/if}
