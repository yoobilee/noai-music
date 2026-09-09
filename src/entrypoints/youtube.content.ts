import { YOUTUBE_MATCH_PATTERNS } from '@/shared/sites';

export default defineContentScript({
  matches: YOUTUBE_MATCH_PATTERNS,
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    // YouTube adapter bootstrap is intentionally deferred to the first feature.
  },
});
