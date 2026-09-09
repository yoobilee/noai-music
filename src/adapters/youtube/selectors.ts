export const YOUTUBE_SELECTORS = {
  videoUnit: [
    'ytd-watch-metadata',
    'ytd-video-renderer',
    'ytd-rich-item-renderer',
    'yt-lockup-view-model',
    'ytd-compact-video-renderer',
    'ytd-playlist-video-renderer',
  ].join(', '),
  watchMetadata: 'ytd-watch-metadata',
  videoLink: 'a[href^="/watch?v="], a[href^="https://www.youtube.com/watch?v="]',
  title: 'h1 yt-formatted-string, #video-title',
  officialMetadataBadge:
    'ytd-badge-supported-renderer, yt-badge-view-model',
  howThisWasMade: 'how-this-was-made-section-view-model',
  officialDisclosureHelpLink:
    'a[href*="support.google.com/youtube/answer/15447836"]',
} as const;
