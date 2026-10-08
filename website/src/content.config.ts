import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number(),
    category: z.enum(['basics', 'advanced']).optional(),
    source: z.string().url().optional(),
    // Authorship & freshness signals. Required (no default) on purpose: a new
    // article missing these fails the build, so we can't forget to set them.
    // Set `updatedDate` when an article is meaningfully revised.
    author: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
  }),
});

export const collections = { articles };
