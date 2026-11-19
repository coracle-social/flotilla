<script lang="ts">
  import Page from "@lib/components/Page.svelte"
  import ArticleForm from "@app/components/ArticleForm.svelte"
  import LogInGate from "@app/components/LogInGate.svelte"
</script>

<Page>
  <LogInGate title="Log in to write an article" message="Articles are published under your name.">
    <ArticleForm>
      {#snippet header()}
        <strong>Write an Article</strong>
      {/snippet}
    </ArticleForm>
  </LogInGate>
</Page>
