export const YOUTUBE_MATCH_PATTERNS = ['https://www.youtube.com/*'];

export const YOUTUBE_MUSIC_MATCH_PATTERNS = [
  'https://music.youtube.com/*',
];

export const SUPPORTED_CONTENT_SCRIPT_MATCHES = [
  ...YOUTUBE_MATCH_PATTERNS,
  ...YOUTUBE_MUSIC_MATCH_PATTERNS,
];

export type SupportedSite = 'youtube' | 'youtube-music';
