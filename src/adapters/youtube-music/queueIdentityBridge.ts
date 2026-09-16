import { isYouTubeVideoId } from '@/shared/youtubeVideoId';

import { YOUTUBE_MUSIC_SELECTORS } from './selectors';

export const YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE =
  'data-noai-queue-video-id';

interface LiveQueueItemElement extends Element {
  data?: {
    videoId?: unknown;
  };
}

function isElement(node: ParentNode): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function collectQueueItems(root: ParentNode): readonly Element[] {
  const items = new Set<Element>();

  if (isElement(root)) {
    if (root.matches(YOUTUBE_MUSIC_SELECTORS.queueItem)) {
      items.add(root);
    }

    const enclosingItem = root.closest(YOUTUBE_MUSIC_SELECTORS.queueItem);
    if (enclosingItem) {
      items.add(enclosingItem);
    }
  }

  for (const item of root.querySelectorAll(YOUTUBE_MUSIC_SELECTORS.queueItem)) {
    items.add(item);
  }

  return [...items];
}

export function syncYouTubeMusicQueueIdentities(root: ParentNode): void {
  for (const item of collectQueueItems(root)) {
    let videoId: unknown;
    try {
      videoId = (item as LiveQueueItemElement).data?.videoId;
    } catch {
      item.removeAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE);
      continue;
    }
    if (typeof videoId === 'string' && isYouTubeVideoId(videoId)) {
      item.setAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE, videoId);
    } else {
      item.removeAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE);
    }
  }
}

export function observeYouTubeMusicQueueIdentities(
  currentDocument: Document,
): () => void {
  const observedRoot = currentDocument.body ?? currentDocument.documentElement;
  if (!observedRoot) {
    return () => undefined;
  }

  syncYouTubeMusicQueueIdentities(currentDocument);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      syncYouTubeMusicQueueIdentities(mutation.target as ParentNode);
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          syncYouTubeMusicQueueIdentities(node as Element);
        }
      }
    }
  });
  const handleNavigation = () =>
    syncYouTubeMusicQueueIdentities(currentDocument);

  observer.observe(observedRoot, { childList: true, subtree: true });
  currentDocument.addEventListener('yt-navigate-finish', handleNavigation);

  return () => {
    observer.disconnect();
    currentDocument.removeEventListener('yt-navigate-finish', handleNavigation);
  };
}
