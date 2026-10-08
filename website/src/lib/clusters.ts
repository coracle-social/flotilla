// Single source of truth for how the knowledge base is organized.
//
// Each article belongs to exactly one cluster. The cluster drives three things
// that must stay in sync:
//   1. the SECTION it appears under on the /articles index
//   2. the BADGE shown under its title (ArticleLayout)
//   3. the PILLAR its "Part of our guide to …" back-link points to
//
// Keep this list in sync when adding articles. Anything not listed here falls
// into a "More" catch-all on the index so it never silently disappears.

export type Cluster = {
  id: string;
  title: string;
  /** Pillar guide this cluster's articles link up to, or null (the pillars themselves). */
  pillar: string | null;
  /** Render as large featured cards on the index (the pillar guides). */
  featured?: boolean;
  slugs: string[];
};

const COMMUNITY = 'how-to-run-an-online-community';
const NOSTR = 'what-is-nostr';

export const CLUSTERS: Cluster[] = [
  {
    id: 'start',
    title: 'Start here',
    pillar: null,
    featured: true,
    slugs: ['how-to-run-an-online-community', 'what-is-nostr'],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    pillar: COMMUNITY,
    slugs: [
      'what-is-flotilla',
      'getting-started',
      'installing-flotilla',
      'logging-in-to-flotilla',
      'setting-up-your-profile',
      'joining-a-space',
    ],
  },
  {
    id: 'comparisons',
    title: 'Comparisons',
    pillar: COMMUNITY,
    slugs: [
      'slack-alternative',
      'discord-alternative',
      'telegram-alternative',
      'mighty-networks-alternative',
    ],
  },
  {
    id: 'nostr',
    title: 'Understanding Nostr',
    pillar: NOSTR,
    slugs: [
      'nostr-terms-explained',
      'understanding-your-nostr-identity',
    ],
  },
  {
    id: 'using',
    title: 'Using Flotilla',
    pillar: COMMUNITY,
    slugs: [
      'spaces-and-rooms-explained',
      'chatting-in-a-space',
      'direct-messages',
      'using-voice-and-video-calls',
      'finding-messages-and-recent-activity',
      'notifications-and-muting',
      'featured-content-and-library',
      'zaps-and-wallet',
      'customizing-how-flotilla-looks',
    ],
  },
  {
    id: 'running',
    title: 'Running a community',
    pillar: COMMUNITY,
    slugs: ['running-a-community', 'managing-a-space', 'controlling-space-access'],
  },
  {
    id: 'hosting',
    title: 'Hosting your space',
    pillar: COMMUNITY,
    slugs: [
      'hosting-with-flotilla',
      'platform-plan',
      'hosting-billing',
      'custom-domain',
      'self-hosting-a-space',
      'setting-up-media-storage-on-your-relay',
      'enabling-voice-and-video-calls-on-your-relay',
      'backing-up-and-upgrading-a-relay',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy, cost & account',
    pillar: COMMUNITY,
    slugs: ['is-flotilla-private', 'privacy-settings', 'deleting-your-account', 'is-flotilla-free'],
  },
  {
    id: 'help',
    title: 'Help & community',
    pillar: COMMUNITY,
    slugs: ['community-and-support'],
  },
];

export function clusterOf(slug: string): Cluster | undefined {
  return CLUSTERS.find((c) => c.slugs.includes(slug));
}
