export const YOUTUBE_SELECTORS = {
  videoUnit: [
    'ytd-watch-metadata',
    'ytd-video-renderer',
    'ytd-rich-item-renderer',
    'yt-lockup-view-model',
    'ytd-compact-video-renderer',
    'ytd-playlist-video-renderer',
  ].join(', '),
  excludedVideoUnitAncestor: 'ytd-ad-slot-renderer',
  watchMetadata: 'ytd-watch-metadata',
  videoLinkPriority: [
    'a#video-title[href]',
    'a#thumbnail[href]',
    'a[href]',
  ],
  playlistNavigationLink:
    'a[href^="/playlist?"], a[href^="https://www.youtube.com/playlist?"], a[href^="https://youtube.com/playlist?"]',
  title: 'h1 yt-formatted-string, #video-title',
  officialMetadataBadge:
    'ytd-badge-supported-renderer, yt-badge-view-model',
  howThisWasMade: 'how-this-was-made-section-view-model',
  officialDisclosureHelpLink:
    'a[href*="support.google.com/youtube/answer/15447836"]',
} as const;
