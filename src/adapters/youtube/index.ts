import type { DomMediaCandidate } from '@/adapters/contracts';
import type { OfficialDisclosureEvidence } from '@/detection/contracts';

import { readYouTubeOfficialDisclosures } from './officialDisclosure';
import { YOUTUBE_SELECTORS } from './selectors';

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

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

function isElement(node: ParentNode): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function getVideoId(candidate: Element, currentUrl: URL): string | undefined {
  const anchor = candidate.querySelector<HTMLAnchorElement>(
    YOUTUBE_SELECTORS.videoLink,
  );

  if (anchor) {
    try {
      const videoId = new URL(
        anchor.getAttribute('href') ?? '',
        currentUrl.origin,
      ).searchParams.get('v');

      if (videoId && VIDEO_ID_PATTERN.test(videoId)) {
        return videoId;
      }
    } catch {
      // A malformed YouTube link makes this candidate indeterminate, not fatal.
    }
  }

  if (candidate.matches(YOUTUBE_SELECTORS.watchMetadata)) {
    const currentVideoId = currentUrl.searchParams.get('v');
    if (currentVideoId && VIDEO_ID_PATTERN.test(currentVideoId)) {
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

function createCandidate(
  element: Element,
  currentUrl: URL,
): DomMediaCandidate | undefined {
  const videoId = getVideoId(element, currentUrl);
  if (!videoId) {
    return undefined;
  }

  return {
    element,
    snapshot: {
      identity: {
        site: 'youtube',
        videoId,
        artistIds: [],
      },
      title: getCandidateTitle(element),
      artistNames: [],
    },
  };
}

function collectCandidateElements(root: ParentNode): readonly Element[] {
  const candidates = new Set<Element>();

  if (isElement(root)) {
    if (root.matches(YOUTUBE_SELECTORS.videoUnit)) {
      candidates.add(root);
    }

    const enclosingCandidate = root.closest(YOUTUBE_SELECTORS.videoUnit);
    if (enclosingCandidate) {
      candidates.add(enclosingCandidate);
    }
  }

  for (const candidate of root.querySelectorAll(YOUTUBE_SELECTORS.videoUnit)) {
    candidates.add(candidate);
  }

  return [...candidates].filter(
    (candidate) =>
      !candidate.parentElement?.closest(YOUTUBE_SELECTORS.videoUnit),
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
