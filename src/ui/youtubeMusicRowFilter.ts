import type { FilterDecision } from '@/filtering/contracts';
import {
  appendFilterAllowlistActions,
  type FilterAllowlistActions,
} from '@/ui/filterAllowlistActions';

export const YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE =
  'data-noai-filter-action';
export const YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE =
  'data-noai-filter-reason';
export const YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE =
  'data-noai-filter-reason-badge';
export const YOUTUBE_MUSIC_FILTER_SURFACE_ATTRIBUTE =
  'data-noai-filter-surface';

export type YouTubeMusicFilterSurface = 'list-row' | 'queue-item';

const FILTER_STYLE_ATTRIBUTE = 'data-noai-youtube-music-row-filter-styles';

function findReasonBadges(element: Element): readonly HTMLElement[] {
  return [
    ...element.querySelectorAll<HTMLElement>(
    `[${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]`,
    ),
  ];
}

function ensureFilterStyles(currentDocument: Document): void {
  if (currentDocument.head?.querySelector(`[${FILTER_STYLE_ATTRIBUTE}]`)) {
    return;
  }

  const style = currentDocument.createElement('style');
  style.setAttribute(FILTER_STYLE_ATTRIBUTE, 'true');
  style.textContent = `
    [${YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE}="hide"]:not([${YOUTUBE_MUSIC_FILTER_SURFACE_ATTRIBUTE}="queue-item"]) {
      display: none !important;
    }
    [${YOUTUBE_MUSIC_FILTER_SURFACE_ATTRIBUTE}="queue-item"][${YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE}="hide"] {
      visibility: hidden !important;
    }
    [${YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE}="blur"],
    [${YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE}="mark"] {
      position: relative !important;
    }
    [${YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE}="blur"] > :not([${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}]) {
      filter: blur(10px) !important;
    }
    [${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}] {
      background: #0f766e !important;
      border-radius: 4px !important;
      color: #ffffff !important;
      align-items: center !important;
      display: flex !important;
      flex-wrap: wrap !important;
      font-family: Roboto, Arial, sans-serif !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      inset-block-start: 4px !important;
      inset-inline-end: 4px !important;
      line-height: 16px !important;
      margin: 0 !important;
      max-width: calc(100% - 8px) !important;
      gap: 4px !important;
      overflow: visible !important;
      padding: 3px 6px !important;
      pointer-events: none !important;
      position: absolute !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      z-index: 1 !important;
    }
    [${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}] .noai-filter-allowlist-action {
      background: #ffffff !important;
      border: 0 !important;
      border-radius: 3px !important;
      color: #0f5f59 !important;
      cursor: pointer !important;
      flex: 0 0 auto !important;
      font: inherit !important;
      line-height: 16px !important;
      padding: 1px 5px !important;
      pointer-events: auto !important;
    }
    [${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}] .noai-filter-allowlist-action:focus-visible {
      outline: 2px solid #ffffff !important;
      outline-offset: 2px !important;
    }
    [${YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE}] > span {
      min-width: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
  `;
  currentDocument.head?.append(style);
}

export function clearYouTubeMusicRowFilter(element: Element): void {
  element.removeAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE);
  element.removeAttribute(YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE);
  element.removeAttribute(YOUTUBE_MUSIC_FILTER_SURFACE_ATTRIBUTE);
  for (const badge of findReasonBadges(element)) {
    badge.remove();
  }
}

export function applyYouTubeMusicRowFilter(
  element: Element,
  decision: FilterDecision,
  reasonText: string,
  allowlistActions?: FilterAllowlistActions,
  surface: YouTubeMusicFilterSurface = 'list-row',
): void {
  clearYouTubeMusicRowFilter(element);
  if (decision.action === 'none') {
    return;
  }

  ensureFilterStyles(element.ownerDocument);
  element.setAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE, decision.action);
  element.setAttribute(YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE, decision.reason);
  element.setAttribute(YOUTUBE_MUSIC_FILTER_SURFACE_ATTRIBUTE, surface);

  if (decision.action === 'hide') {
    return;
  }

  const badge = element.ownerDocument.createElement('span');
  badge.setAttribute(YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE, 'true');
  const reason = element.ownerDocument.createElement('span');
  reason.textContent = reasonText;
  badge.append(reason);
  appendFilterAllowlistActions(badge, allowlistActions);
  badge.setAttribute(
    'role',
    badge.querySelector('button') === null ? 'note' : 'group',
  );
  badge.setAttribute('aria-label', reasonText);
  badge.title = reasonText;
  element.append(badge);
}

export function isYouTubeMusicRowFilterCurrent(
  element: Element,
  decision: FilterDecision,
  surface: YouTubeMusicFilterSurface = 'list-row',
): boolean {
  const action = element.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE);
  const badgeCount = findReasonBadges(element).length;

  if (decision.action === 'none') {
    return action === null && badgeCount === 0;
  }

  return (
    action === decision.action &&
    element.getAttribute(YOUTUBE_MUSIC_FILTER_SURFACE_ATTRIBUTE) === surface &&
    element.getAttribute(YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE) ===
      decision.reason &&
    (decision.action === 'hide' ? badgeCount === 0 : badgeCount === 1)
  );
}

export function findAppliedYouTubeMusicRowFilterElements(
  root: ParentNode,
): readonly Element[] {
  const elements = new Set<Element>();
  if (root instanceof Element) {
    const enclosing = root.closest(
      `[${YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE}]`,
    );
    if (enclosing) {
      elements.add(enclosing);
    }
  }
  for (const element of root.querySelectorAll(
    `[${YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE}]`,
  )) {
    elements.add(element);
  }
  return [...elements];
}

export function clearAllYouTubeMusicRowFilters(root: ParentNode): void {
  for (const element of findAppliedYouTubeMusicRowFilterElements(root)) {
    clearYouTubeMusicRowFilter(element);
  }
}
