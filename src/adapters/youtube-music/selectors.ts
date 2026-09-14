export const YOUTUBE_MUSIC_SELECTORS = {
  playableRow: 'ytmusic-responsive-list-item-renderer',
  rowLinkPriority: ['.title a[href]', 'a[href]'],
  playerBar: 'ytmusic-player-bar',
  playerLinkPriority: ['.title a[href]', 'a[href]'],
  nextButton: '.next-button.ytmusic-player-bar',
} as const;
