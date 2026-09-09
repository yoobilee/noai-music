import type { SiteAdapter } from '@/adapters/contracts';

export type YouTubeAdapter = SiteAdapter & {
  readonly site: 'youtube';
};
