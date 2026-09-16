import { observeYouTubeMusicQueueIdentities } from '@/adapters/youtube-music/queueIdentityBridge';
import { YOUTUBE_MUSIC_MATCH_PATTERNS } from '@/shared/sites';

export default defineContentScript({
  matches: YOUTUBE_MUSIC_MATCH_PATTERNS,
  runAt: 'document_idle',
  world: 'MAIN',
  main() {
    observeYouTubeMusicQueueIdentities(document);
  },
});
