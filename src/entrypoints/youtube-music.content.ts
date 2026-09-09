import { YOUTUBE_MUSIC_MATCH_PATTERNS } from '@/shared/sites';

export default defineContentScript({
  matches: YOUTUBE_MUSIC_MATCH_PATTERNS,
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    // YouTube Music adapter bootstrap is intentionally deferred to the first feature.
  },
});
