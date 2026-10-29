<script lang="ts">
  import Page from "@lib/components/Page.svelte"
  import ArticleDetail from "@app/components/ArticleDetail.svelte"
  import * as pages from "@app/navigation/pages"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {address, relays} = pages.networkArticle.decode(params)
</script>

<Page>
  <ArticleDetail {address} {relays} />
</Page>
