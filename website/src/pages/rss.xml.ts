import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { clusterOf } from '../lib/clusters';

const FEED_PATH = '/rss.xml';
const TITLE = 'Flotilla Knowledge Base';
const DESCRIPTION =
  'Guides and answers for getting the most out of Flotilla — from joining your first space to running your own community.';

const markdown = new MarkdownIt({ html: true, linkify: true });

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Escape a value for the hand-built XML we pass through `customData`. */
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);

// Article bodies open with an h1 that repeats the title, which ArticleLayout hides
// with CSS. Strip it so feed readers don't show the title twice.
const stripLeadingH1 = (body: string) => body.replace(/^\s*#\s+[^\n]*\n+/, '');

export const GET: APIRoute = async (context) => {
  // `site` is set in astro.config.mjs, so this is always defined.
  const site = context.site!;

  // Feed readers resolve relative URLs against their own address, so the body's
  // root-relative links and images are made absolute.
  const absolutize = (html: string) =>
    html.replace(
      /\s(href|src)="(\/(?!\/)[^"]*)"/g,
      (_match, attr: string, path: string) => ` ${attr}="${new URL(path, site).href}"`,
    );

  const toHtml = (body: string) =>
    sanitizeHtml(absolutize(markdown.render(stripLeadingH1(body))), {
      // The default allowlist covers everything the articles use except images.
      allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    });

  const articles = await getCollection('articles');

  const items = articles
    // Newest first. Articles with the same publication date keep their knowledge-base order.
    .sort(
      (a, b) =>
        b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.data.order - b.data.order,
    )
    .map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.pubDate,
      link: `/articles/${article.id}/`,
      content: toHtml(article.body ?? ''),
      categories: [clusterOf(article.id)?.title, article.data.category].filter(
        (c): c is string => Boolean(c),
      ),
      // RSS 2.0's <author> is an email address, which we don't publish, so the
      // byline goes in Dublin Core's <dc:creator>.
      customData: [
        `<dc:creator>${escapeXml(article.data.author)}</dc:creator>`,
        article.data.updatedDate
          ? `<atom:updated>${article.data.updatedDate.toISOString()}</atom:updated>`
          : '',
      ].join(''),
    }));

  return rss({
    title: TITLE,
    description: DESCRIPTION,
    site,
    items,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
      dc: 'http://purl.org/dc/elements/1.1/',
    },
    customData: [
      '<language>en-us</language>',
      `<atom:link href="${new URL(FEED_PATH, site).href}" rel="self" type="application/rss+xml" />`,
    ].join(''),
  });
};
