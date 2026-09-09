import type { DomMediaCandidate, SiteAdapter } from '@/adapters/contracts';

export type YouTubeMusicAdapter = SiteAdapter & {
  readonly site: 'youtube-music';
  getNowPlayingCandidate(): DomMediaCandidate | undefined;
  skipNowPlaying(): boolean;
};
