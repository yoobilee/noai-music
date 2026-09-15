import type { DomMediaCandidate } from '@/adapters/contracts';
import type { FilterDecision } from '@/filtering/contracts';
import {
  appendFilterAllowlistActions,
  type FilterAllowlistActions,
} from '@/ui/filterAllowlistActions';

export const FILTER_ACTION_ATTRIBUTE = 'data-noai-filter-action';
export const FILTER_REASON_ATTRIBUTE = 'data-noai-filter-reason';
export const FILTER_REASON_BADGE_ATTRIBUTE = 'data-noai-filter-reason-badge';
export const FILTER_OVERLAY_ANCHOR_ATTRIBUTE =
  'data-noai-filter-overlay-anchor';
export const FILTER_OVERLAY_PATH_ATTRIBUTE = 'data-noai-filter-overlay-path';

const FILTER_STYLE_ATTRIBUTE = 'data-noai-youtube-card-filter-styles';

function findReasonBadges(element: Element): readonly HTMLElement[] {
  return [
    ...element.querySelectorAll<HTMLElement>(
      `[${FILTER_REASON_BADGE_ATTRIBUTE}]`,
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
    [${FILTER_ACTION_ATTRIBUTE}="hide"] {
      display: none !important;
    }
    [${FILTER_ACTION_ATTRIBUTE}="blur"] > :not([${FILTER_OVERLAY_PATH_ATTRIBUTE}]) {
      filter: blur(10px) !important;
    }
    [${FILTER_ACTION_ATTRIBUTE}="blur"] [${FILTER_OVERLAY_PATH_ATTRIBUTE}] > :not([${FILTER_OVERLAY_PATH_ATTRIBUTE}]):not([${FILTER_REASON_BADGE_ATTRIBUTE}]) {
      filter: blur(10px) !important;
    }
    [${FILTER_OVERLAY_ANCHOR_ATTRIBUTE}] {
      position: relative !important;
    }
    [${FILTER_REASON_BADGE_ATTRIBUTE}] {
      background: #0f766e !important;
      border-radius: 4px !important;
      color: #ffffff !important;
      align-items: center !important;
      display: inline-flex !important;
      flex-wrap: wrap !important;
      gap: 4px !important;
      font-family: Roboto, Arial, sans-serif !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      inset-block-end: 6px !important;
      inset-inline-start: 6px !important;
      line-height: 16px !important;
      margin: 0 !important;
      max-width: calc(100% - 12px) !important;
      padding: 3px 6px !important;
      pointer-events: none !important;
      position: absolute !important;
      z-index: 4 !important;
    }
    [${FILTER_REASON_BADGE_ATTRIBUTE}] .noai-filter-allowlist-action {
      background: #ffffff !important;
      border: 0 !important;
      border-radius: 3px !important;
      color: #0f5f59 !important;
      cursor: pointer !important;
      font: inherit !important;
      line-height: 16px !important;
      padding: 1px 5px !important;
      pointer-events: auto !important;
    }
    [${FILTER_REASON_BADGE_ATTRIBUTE}] .noai-filter-allowlist-action:focus-visible {
      outline: 2px solid #ffffff !important;
      outline-offset: 2px !important;
    }
    [${FILTER_REASON_BADGE_ATTRIBUTE}] > span {
      min-width: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
  `;
  currentDocument.head?.append(style);
}

function clearOverlayMountState(element: Element): void {
  for (const mounted of element.querySelectorAll(
    `[${FILTER_OVERLAY_ANCHOR_ATTRIBUTE}], [${FILTER_OVERLAY_PATH_ATTRIBUTE}]`,
  )) {
    mounted.removeAttribute(FILTER_OVERLAY_ANCHOR_ATTRIBUTE);
    mounted.removeAttribute(FILTER_OVERLAY_PATH_ATTRIBUTE);
  }
}

function prepareOverlayMount(
  card: Element,
  anchor: HTMLElement,
): boolean {
  if (anchor === card || !card.contains(anchor)) {
    return false;
  }

  let current: HTMLElement | null = anchor;
  while (current !== card) {
    current.setAttribute(FILTER_OVERLAY_PATH_ATTRIBUTE, 'true');
    current = current.parentElement;
    if (current === null) {
      clearOverlayMountState(card);
      return false;
    }
  }

  anchor.setAttribute(FILTER_OVERLAY_ANCHOR_ATTRIBUTE, 'true');
  return true;
}

export function clearYouTubeCardFilter(element: Element): void {
  element.removeAttribute(FILTER_ACTION_ATTRIBUTE);
  element.removeAttribute(FILTER_REASON_ATTRIBUTE);
  for (const badge of findReasonBadges(element)) {
    badge.remove();
  }
  clearOverlayMountState(element);
}

export function applyYouTubeCardFilter(
  candidate: DomMediaCandidate,
  decision: FilterDecision,
  reasonText: string,
  allowlistActions?: FilterAllowlistActions,
): void {
  clearYouTubeCardFilter(candidate.element);
  if (decision.action === 'none' || candidate.surface !== 'video-card') {
    return;
  }

  ensureFilterStyles(candidate.element.ownerDocument);
  candidate.element.setAttribute(FILTER_ACTION_ATTRIBUTE, decision.action);
  candidate.element.setAttribute(FILTER_REASON_ATTRIBUTE, decision.reason);

  if (decision.action === 'hide') {
    return;
  }

  const overlayAnchor = candidate.filterOverlayAnchor;
  if (
    overlayAnchor === undefined ||
    !prepareOverlayMount(candidate.element, overlayAnchor)
  ) {
    candidate.element.removeAttribute(FILTER_ACTION_ATTRIBUTE);
    candidate.element.removeAttribute(FILTER_REASON_ATTRIBUTE);
    return;
  }

  const badge = candidate.element.ownerDocument.createElement('span');
  badge.setAttribute(FILTER_REASON_BADGE_ATTRIBUTE, 'true');
  const reason = candidate.element.ownerDocument.createElement('span');
  reason.textContent = reasonText;
  badge.append(reason);
  appendFilterAllowlistActions(badge, allowlistActions);
  badge.setAttribute(
    'role',
    badge.querySelector('button') === null ? 'note' : 'group',
  );
  badge.setAttribute('aria-label', reasonText);
  badge.title = reasonText;
  overlayAnchor.append(badge);
}

export function isYouTubeCardFilterCurrent(
  element: Element,
  decision: FilterDecision,
): boolean {
  const action = element.getAttribute(FILTER_ACTION_ATTRIBUTE);
  const badges = findReasonBadges(element);
  const badgeCount = badges.length;

  if (decision.action === 'none') {
    return action === null && badgeCount === 0;
  }

  return (
    action === decision.action &&
    element.getAttribute(FILTER_REASON_ATTRIBUTE) === decision.reason &&
    (decision.action === 'hide'
      ? badgeCount === 0
      : badgeCount === 1 &&
        badges[0]?.parentElement?.hasAttribute(
          FILTER_OVERLAY_ANCHOR_ATTRIBUTE,
        ) === true)
  );
}

export function findAppliedFilterElements(root: ParentNode): readonly Element[] {
  const elements = new Set<Element>();
  if (root instanceof Element) {
    const enclosing = root.closest(`[${FILTER_ACTION_ATTRIBUTE}]`);
    if (enclosing) {
      elements.add(enclosing);
    }
  }
  for (const element of root.querySelectorAll(`[${FILTER_ACTION_ATTRIBUTE}]`)) {
    elements.add(element);
  }
  return [...elements];
}

export function clearAllYouTubeCardFilters(root: ParentNode): void {
  for (const element of findAppliedFilterElements(root)) {
    clearYouTubeCardFilter(element);
  }
}
