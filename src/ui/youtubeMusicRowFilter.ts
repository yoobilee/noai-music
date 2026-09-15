import type { FilterDecision } from '@/filtering/contracts';

export const YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE =
  'data-noai-filter-action';
export const YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE =
  'data-noai-filter-reason';
export const YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE =
  'data-noai-filter-reason-badge';

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
    [${YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE}="hide"] {
      display: none !important;
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
      display: block !important;
      font-family: Roboto, Arial, sans-serif !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      inset-block-start: 4px !important;
      inset-inline-end: 4px !important;
      line-height: 16px !important;
      margin: 0 !important;
      max-width: calc(100% - 8px) !important;
      overflow: hidden !important;
      padding: 3px 6px !important;
      pointer-events: none !important;
      position: absolute !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      z-index: 1 !important;
    }
  `;
  currentDocument.head?.append(style);
}

export function clearYouTubeMusicRowFilter(element: Element): void {
  element.removeAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE);
  element.removeAttribute(YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE);
  for (const badge of findReasonBadges(element)) {
    badge.remove();
  }
}

export function applyYouTubeMusicRowFilter(
  element: Element,
  decision: FilterDecision,
  reasonText: string,
): void {
  clearYouTubeMusicRowFilter(element);
  if (decision.action === 'none') {
    return;
  }

  ensureFilterStyles(element.ownerDocument);
  element.setAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE, decision.action);
  element.setAttribute(YOUTUBE_MUSIC_FILTER_REASON_ATTRIBUTE, decision.reason);

  if (decision.action === 'hide') {
    return;
  }

  const badge = element.ownerDocument.createElement('span');
  badge.setAttribute(YOUTUBE_MUSIC_FILTER_REASON_BADGE_ATTRIBUTE, 'true');
  badge.setAttribute('role', 'note');
  badge.textContent = reasonText;
  badge.title = reasonText;
  element.append(badge);
}

export function isYouTubeMusicRowFilterCurrent(
  element: Element,
  decision: FilterDecision,
): boolean {
  const action = element.getAttribute(YOUTUBE_MUSIC_FILTER_ACTION_ATTRIBUTE);
  const badgeCount = findReasonBadges(element).length;

  if (decision.action === 'none') {
    return action === null && badgeCount === 0;
  }

  return (
    action === decision.action &&
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
