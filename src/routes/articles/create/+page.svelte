<script lang="ts">
  import Page from "@lib/components/Page.svelte"
  import ArticleForm from "@app/components/ArticleForm.svelte"
  import {user} from "@app/core/user"
  import LogInPanel from "@app/components/LogInPanel.svelte"
</script>

<Page>
  {#if $user}
    <ArticleForm>
      {#snippet header()}
        <strong>Write an Article</strong>
      {/snippet}
    </ArticleForm>
  {:else}
    <LogInPanel
      title="Log in to write an article"
      message="Articles are published under your name." />
  {/if}
</Page>
