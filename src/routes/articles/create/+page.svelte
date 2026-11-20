<script lang="ts">
  import Page from "@lib/components/Page.svelte"
  import ArticleForm from "@app/components/ArticleForm.svelte"
</script>

<Page>
  <ArticleForm>
    {#snippet header()}
      <strong>Write an Article</strong>
    {/snippet}
  </ArticleForm>
</Page>
