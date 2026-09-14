const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isYouTubeVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}

export function readStrictYouTubeVideoIdParameter(url: URL): string | null {
  const decodedVideoIds = url.searchParams.getAll('v');
  if (decodedVideoIds.length !== 1) {
    return null;
  }

  const [videoId] = decodedVideoIds;
  if (videoId === undefined || !isYouTubeVideoId(videoId)) {
    return null;
  }

  const rawMatches = [...url.search.matchAll(/(?:^\?|&)v=([^&]*)/g)];
  return rawMatches.length === 1 && rawMatches[0]?.[1] === videoId
    ? videoId
    : null;
}
