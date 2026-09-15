import type { DomMediaCandidate } from '@/adapters/contracts';
import type { OfficialDisclosureEvidence } from '@/detection/contracts';

import { readYouTubeOfficialDisclosures } from './officialDisclosure';
import { YOUTUBE_SELECTORS } from './selectors';
import { parseYouTubeWatchVideoId } from './videoId';
import { parseYouTubeArtistHref } from '@/shared/youtubeArtistId';
import { parseYouTubeChannelHandleHref } from '@/shared/youtubeChannelHandle';

interface YouTubeAdapterEnvironment {
  document: Document;
  getCurrentUrl: () => URL;
  createMutationObserver: (callback: MutationCallback) => MutationObserver;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
}

export interface YouTubeAdapter {
  readonly site: 'youtube';
  getRouteKey(url: URL): string;
  collectCandidates(root: ParentNode): readonly DomMediaCandidate[];
  readOfficialDisclosures(
    candidate: DomMediaCandidate,
  ): readonly OfficialDisclosureEvidence[];
  observePage(onChange: (roots: readonly ParentNode[]) => void): () => void;
  getCurrentUrl(): URL;
}

function isElement(node: ParentNode): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function getVideoId(candidate: Element, currentUrl: URL): string | undefined {
  if (
    !candidate.matches(YOUTUBE_SELECTORS.watchMetadata) &&
    candidate.querySelector(YOUTUBE_SELECTORS.playlistNavigationLink)
  ) {
    return undefined;
  }

  for (const selector of YOUTUBE_SELECTORS.videoLinkPriority) {
    const videoIds = new Set<string>();

    for (const anchor of candidate.querySelectorAll<HTMLAnchorElement>(selector)) {
      const videoId = parseYouTubeWatchVideoId(anchor.getAttribute('href'));
      if (videoId !== null) {
        videoIds.add(videoId);
      }
    }

    if (videoIds.size === 1) {
      return videoIds.values().next().value;
    }

    if (videoIds.size > 1) {
      return undefined;
    }
  }

  if (candidate.matches(YOUTUBE_SELECTORS.watchMetadata)) {
    const currentVideoId = parseYouTubeWatchVideoId(currentUrl.href);
    if (currentVideoId !== null) {
      return currentVideoId;
    }
  }

  return undefined;
}

function getCandidateTitle(candidate: Element): string | undefined {
  const text = candidate.querySelector(YOUTUBE_SELECTORS.title)?.textContent;
  const normalized = text?.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

function getArtistIds(candidate: Element): readonly string[] {
  const artistIds = new Set<string>();
  for (const anchor of candidate.querySelectorAll<HTMLAnchorElement>(
    YOUTUBE_SELECTORS.channelIdentityLinks,
  )) {
    const artistId = parseYouTubeArtistHref(
      anchor.getAttribute('href'),
      'youtube',
    );
    if (artistId !== null) {
      artistIds.add(artistId);
    }
  }
  return [...artistIds].sort();
}

function getChannelHandles(candidate: Element): readonly string[] {
  const handles = new Set<string>();
  for (const anchor of candidate.querySelectorAll<HTMLAnchorElement>(
    YOUTUBE_SELECTORS.channelIdentityLinks,
  )) {
    const handle = parseYouTubeChannelHandleHref(anchor.getAttribute('href'));
    if (handle !== null) handles.add(handle);
  }
  return [...handles].sort();
}

function getFilterOverlayAnchor(candidate: Element): HTMLElement | undefined {
  return (
    candidate.querySelector<HTMLElement>(
      YOUTUBE_SELECTORS.filterOverlayAnchor,
    ) ?? undefined
  );
}

function createCandidate(
  element: Element,
  currentUrl: URL,
): DomMediaCandidate | undefined {
  const videoId = getVideoId(element, currentUrl);
  if (!videoId) {
    return undefined;
  }
  const artistIds = getArtistIds(element);
  const channelHandles = getChannelHandles(element);

  return {
    element,
    surface: element.matches(YOUTUBE_SELECTORS.watchMetadata)
      ? 'watch-page'
      : 'video-card',
    filterOverlayAnchor: getFilterOverlayAnchor(element),
    snapshot: {
      identity: {
        site: 'youtube',
        videoId,
        channelId: artistIds.length === 1 ? artistIds[0] : undefined,
        channelHandle:
          channelHandles.length === 1 ? channelHandles[0] : undefined,
        artistIds,
      },
      title: getCandidateTitle(element),
      artistNames: [],
    },
  };
}

function getOutermostCandidateElement(element: Element): Element | null {
  let candidate = element.closest(YOUTUBE_SELECTORS.videoUnit);
  let parentCandidate = candidate?.parentElement?.closest(
    YOUTUBE_SELECTORS.videoUnit,
  );
  while (parentCandidate) {
    candidate = parentCandidate;
    parentCandidate = candidate.parentElement?.closest(
      YOUTUBE_SELECTORS.videoUnit,
    );
  }
  return candidate;
}

function collectCandidateElements(root: ParentNode): readonly Element[] {
  const candidates = new Set<Element>();

  if (isElement(root)) {
    const enclosingCandidate = getOutermostCandidateElement(root);
    if (enclosingCandidate) {
      candidates.add(enclosingCandidate);
    }
  }

  for (const candidate of root.querySelectorAll(YOUTUBE_SELECTORS.videoUnit)) {
    candidates.add(candidate);
  }

  return [...candidates].filter(
    (candidate) =>
      !candidate.parentElement?.closest(YOUTUBE_SELECTORS.videoUnit) &&
      !candidate.closest(YOUTUBE_SELECTORS.excludedVideoUnitAncestor),
  );
}

function defaultEnvironment(): YouTubeAdapterEnvironment {
  return {
    document,
    getCurrentUrl: () => new URL(location.href),
    createMutationObserver: (callback) => new MutationObserver(callback),
    requestAnimationFrame: (callback) => requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
  };
}

export function createYouTubeAdapter(
  environment: YouTubeAdapterEnvironment = defaultEnvironment(),
): YouTubeAdapter {
  const { document: currentDocument } = environment;

  return {
    site: 'youtube',
    getCurrentUrl: environment.getCurrentUrl,
    getRouteKey(url) {
      return `${url.pathname}${url.search}`;
    },
    collectCandidates(root) {
      try {
        const currentUrl = environment.getCurrentUrl();
        return collectCandidateElements(root).flatMap((element) => {
          const candidate = createCandidate(element, currentUrl);
          return candidate ? [candidate] : [];
        });
      } catch {
        return [];
      }
    },
    readOfficialDisclosures(candidate) {
      return readYouTubeOfficialDisclosures(candidate.element);
    },
    observePage(onChange) {
      const observedRoot = currentDocument.body ?? currentDocument.documentElement;
      if (!observedRoot) {
        return () => undefined;
      }

      const pendingRoots = new Set<ParentNode>();
      let animationFrame: number | undefined;

      const flush = () => {
        animationFrame = undefined;
        if (pendingRoots.size === 0) {
          return;
        }

        const roots = [...pendingRoots];
        pendingRoots.clear();
        onChange(roots);
      };

      const schedule = (root: ParentNode) => {
        pendingRoots.add(root);
        if (animationFrame === undefined) {
          animationFrame = environment.requestAnimationFrame(flush);
        }
      };

      const observer = environment.createMutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            schedule(mutation.target as Element);
            continue;
          }

          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              schedule(node as Element);
            }
          }

          if (mutation.removedNodes.length > 0) {
            schedule(mutation.target as Element);
          }
        }
      });

      const handleNavigation = () => schedule(currentDocument);

      observer.observe(observedRoot, {
        attributeFilter: ['aria-label', 'href'],
        attributes: true,
        childList: true,
        subtree: true,
      });
      currentDocument.addEventListener('yt-navigate-finish', handleNavigation);

      return () => {
        observer.disconnect();
        currentDocument.removeEventListener(
          'yt-navigate-finish',
          handleNavigation,
        );
        pendingRoots.clear();
        if (animationFrame !== undefined) {
          environment.cancelAnimationFrame(animationFrame);
        }
      };
    },
  };
}
