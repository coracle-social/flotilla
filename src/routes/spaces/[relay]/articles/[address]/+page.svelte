<script lang="ts">
  import ArticleDetail from "@app/components/ArticleDetail.svelte"
  import * as pages from "@app/navigation/pages"
  import type {PageProps} from "./$types"

  const {params}: PageProps = $props()

  const {url, address} = pages.article.decode(params)
</script>

<ArticleDetail {url} {address} relays={[url]} />
