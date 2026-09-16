import type { MediaCandidateSnapshot } from '@/detection/contracts';
import { parseYouTubeArtistHref } from '@/shared/youtubeArtistId';
import { isYouTubeVideoId } from '@/shared/youtubeVideoId';

import { YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE } from './queueIdentityBridge';
import { YOUTUBE_MUSIC_SELECTORS } from './selectors';
import { parseYouTubeMusicWatchVideoId } from './videoId';

export type YouTubeMusicCandidateSurface =
  | 'search-result'
  | 'album-track'
  | 'playlist-track'
  | 'artist-song'
  | 'queue-item'
  | 'player-current';

export interface YouTubeMusicMediaCandidate {
  element: Element;
  surface: YouTubeMusicCandidateSurface;
  snapshot: MediaCandidateSnapshot;
}

interface YouTubeMusicAdapterEnvironment {
  document: Document;
  getCurrentUrl: () => URL;
  createMutationObserver: (callback: MutationCallback) => MutationObserver;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
}

export interface YouTubeMusicAdapter {
  readonly site: 'youtube-music';
  getRouteKey(url: URL): string;
  getCurrentUrl(): URL;
  collectCandidates(root: ParentNode): readonly YouTubeMusicMediaCandidate[];
  getNowPlayingCandidate(): YouTubeMusicMediaCandidate | undefined;
  clickNext(expectedVideoId: string): boolean;
  observePage(onChange: (roots: readonly ParentNode[]) => void): () => void;
  observePlayer(onChange: () => void): () => void;
}

function isElement(node: ParentNode): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function readUnambiguousVideoId(
  element: Element,
  selectorPriority: readonly string[],
): string | undefined {
  for (const selector of selectorPriority) {
    const videoIds = new Set<string>();

    for (const anchor of element.querySelectorAll<HTMLAnchorElement>(selector)) {
      const videoId = parseYouTubeMusicWatchVideoId(
        anchor.getAttribute('href'),
      );
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

  return undefined;
}

function createCandidate(
  element: Element,
  surface: YouTubeMusicCandidateSurface,
  selectorPriority: readonly string[],
): YouTubeMusicMediaCandidate | undefined {
  const videoId = readUnambiguousVideoId(element, selectorPriority);
  if (videoId === undefined) {
    return undefined;
  }
  const artistIds = new Set<string>();
  for (const anchor of element.querySelectorAll<HTMLAnchorElement>(
    YOUTUBE_MUSIC_SELECTORS.artistLinks,
  )) {
    const artistId = parseYouTubeArtistHref(
      anchor.getAttribute('href'),
      'youtube-music',
    );
    if (artistId !== null) {
      artistIds.add(artistId);
    }
  }
  const normalizedArtistIds = [...artistIds].sort();

  return {
    element,
    surface,
    snapshot: {
      identity: {
        site: 'youtube-music',
        videoId,
        channelId:
          normalizedArtistIds.length === 1
            ? normalizedArtistIds[0]
            : undefined,
        artistIds: normalizedArtistIds,
      },
      artistNames: [],
    },
  };
}

function getListSurface(url: URL): YouTubeMusicCandidateSurface | undefined {
  if (!isSupportedYouTubeMusicUrl(url)) {
    return undefined;
  }

  if (url.pathname === '/search') {
    return 'search-result';
  }

  if (/^\/browse\/MPRE[A-Za-z0-9_-]+$/.test(url.pathname)) {
    return 'album-track';
  }

  if (
    url.pathname === '/playlist' &&
    url.searchParams.getAll('list').length === 1 &&
    url.searchParams.get('list')
  ) {
    return 'playlist-track';
  }

  if (/^\/channel\/UC[A-Za-z0-9_-]{22}$/.test(url.pathname)) {
    return 'artist-song';
  }

  return undefined;
}

function isSupportedYouTubeMusicUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    url.hostname.toLocaleLowerCase() === 'music.youtube.com' &&
    url.port === ''
  );
}

function collectRowElements(root: ParentNode): readonly Element[] {
  const rows = new Set<Element>();

  if (isElement(root)) {
    if (root.matches(YOUTUBE_MUSIC_SELECTORS.playableRow)) {
      rows.add(root);
    }

    const enclosingRow = root.closest(YOUTUBE_MUSIC_SELECTORS.playableRow);
    if (enclosingRow) {
      rows.add(enclosingRow);
    }
  }

  for (const row of root.querySelectorAll(YOUTUBE_MUSIC_SELECTORS.playableRow)) {
    rows.add(row);
  }

  return [...rows];
}

function collectMatchingElements(
  root: ParentNode,
  selector: string,
): readonly Element[] {
  const elements = new Set<Element>();

  if (isElement(root)) {
    if (root.matches(selector)) {
      elements.add(root);
    }

    const enclosingElement = root.closest(selector);
    if (enclosingElement) {
      elements.add(enclosingElement);
    }
  }

  for (const element of root.querySelectorAll(selector)) {
    elements.add(element);
  }

  return [...elements];
}

function createQueueCandidate(
  element: Element,
): YouTubeMusicMediaCandidate | undefined {
  const videoId = element.getAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE);
  if (videoId === null || !isYouTubeVideoId(videoId)) {
    return undefined;
  }

  return {
    element,
    surface: 'queue-item',
    snapshot: {
      identity: {
        site: 'youtube-music',
        videoId,
        artistIds: [],
      },
      artistNames: [],
    },
  };
}

function defaultEnvironment(): YouTubeMusicAdapterEnvironment {
  return {
    document,
    getCurrentUrl: () => new URL(location.href),
    createMutationObserver: (callback) => new MutationObserver(callback),
    requestAnimationFrame: (callback) => requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
  };
}

export function createYouTubeMusicAdapter(
  environment: YouTubeMusicAdapterEnvironment = defaultEnvironment(),
): YouTubeMusicAdapter {
  return {
    site: 'youtube-music',
    getCurrentUrl: environment.getCurrentUrl,
    getRouteKey(url) {
      return `${url.pathname}${url.search}`;
    },
    collectCandidates(root) {
      try {
        const currentUrl = environment.getCurrentUrl();
        if (!isSupportedYouTubeMusicUrl(currentUrl)) {
          return [];
        }

        const candidates: YouTubeMusicMediaCandidate[] = [];
        const surface = getListSurface(currentUrl);
        if (surface !== undefined) {
          for (const element of collectRowElements(root)) {
            const candidate = createCandidate(
              element,
              surface,
              YOUTUBE_MUSIC_SELECTORS.rowLinkPriority,
            );
            if (candidate) {
              candidates.push(candidate);
            }
          }
        }

        for (const element of collectMatchingElements(
          root,
          YOUTUBE_MUSIC_SELECTORS.queueItem,
        )) {
          const candidate = createQueueCandidate(element);
          if (candidate) {
            candidates.push(candidate);
          }
        }

        return candidates;
      } catch {
        return [];
      }
    },
    getNowPlayingCandidate() {
      try {
        const playerBar = environment.document.querySelector(
          YOUTUBE_MUSIC_SELECTORS.playerBar,
        );
        return playerBar
          ? createCandidate(
              playerBar,
              'player-current',
              YOUTUBE_MUSIC_SELECTORS.playerLinkPriority,
            )
          : undefined;
      } catch {
        return undefined;
      }
    },
    clickNext(expectedVideoId) {
      try {
        const currentVideoId = this.getNowPlayingCandidate()?.snapshot.identity.videoId;
        if (currentVideoId !== expectedVideoId) {
          return false;
        }

        const playerBar = environment.document.querySelector(
          YOUTUBE_MUSIC_SELECTORS.playerBar,
        );
        const nextButton = playerBar?.querySelector<HTMLElement>(
          YOUTUBE_MUSIC_SELECTORS.nextButton,
        );
        if (
          !nextButton ||
          !nextButton.isConnected ||
          nextButton.hasAttribute('disabled') ||
          nextButton.getAttribute('aria-disabled') === 'true' ||
          ('disabled' in nextButton && nextButton.disabled === true)
        ) {
          return false;
        }

        nextButton.click();
        return true;
      } catch {
        return false;
      }
    },
    observePage(onChange) {
      const observedRoot =
        environment.document.body ?? environment.document.documentElement;
      if (!observedRoot) {
        return () => undefined;
      }

      const pendingRoots = new Set<ParentNode>();
      let animationFrame: number | undefined;
      let observedRouteKey = this.getRouteKey(environment.getCurrentUrl());

      const flush = () => {
        animationFrame = undefined;
        if (pendingRoots.size === 0) {
          return;
        }

        const nextRouteKey = this.getRouteKey(environment.getCurrentUrl());
        const roots =
          nextRouteKey === observedRouteKey
            ? [...pendingRoots]
            : [environment.document];
        observedRouteKey = nextRouteKey;
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
      const handleNavigation = () => schedule(environment.document);
      const handlePopState = () => schedule(environment.document);

      observer.observe(observedRoot, {
        attributeFilter: [
          'aria-hidden',
          'hidden',
          'href',
          YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE,
        ],
        attributes: true,
        childList: true,
        subtree: true,
      });
      environment.document.addEventListener(
        'yt-navigate-finish',
        handleNavigation,
      );
      environment.document.defaultView?.addEventListener(
        'popstate',
        handlePopState,
      );

      return () => {
        observer.disconnect();
        environment.document.removeEventListener(
          'yt-navigate-finish',
          handleNavigation,
        );
        environment.document.defaultView?.removeEventListener(
          'popstate',
          handlePopState,
        );
        pendingRoots.clear();
        if (animationFrame !== undefined) {
          environment.cancelAnimationFrame(animationFrame);
        }
      };
    },
    observePlayer(onChange) {
      const observedRoot =
        environment.document.body ?? environment.document.documentElement;
      if (!observedRoot) {
        return () => undefined;
      }

      let animationFrame: number | undefined;
      const schedule = () => {
        if (animationFrame === undefined) {
          animationFrame = environment.requestAnimationFrame(() => {
            animationFrame = undefined;
            onChange();
          });
        }
      };
      const observer = environment.createMutationObserver(schedule);
      const handleNavigation = () => schedule();

      observer.observe(observedRoot, {
        attributeFilter: ['aria-disabled', 'disabled', 'href'],
        attributes: true,
        childList: true,
        subtree: true,
      });
      environment.document.addEventListener(
        'yt-navigate-finish',
        handleNavigation,
      );

      return () => {
        observer.disconnect();
        environment.document.removeEventListener(
          'yt-navigate-finish',
          handleNavigation,
        );
        if (animationFrame !== undefined) {
          environment.cancelAnimationFrame(animationFrame);
        }
      };
    },
  };
}
