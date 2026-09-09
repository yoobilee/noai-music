import type { DomMediaCandidate } from '@/adapters/contracts';
import type { FilterDecision } from '@/filtering/contracts';

export const FILTER_ACTION_ATTRIBUTE = 'data-noai-filter-action';
export const FILTER_REASON_ATTRIBUTE = 'data-noai-filter-reason';
export const FILTER_REASON_BADGE_ATTRIBUTE = 'data-noai-filter-reason-badge';

const FILTER_STYLE_ATTRIBUTE = 'data-noai-youtube-card-filter-styles';

function findReasonBadge(element: Element): HTMLElement | null {
  return element.querySelector<HTMLElement>(`[${FILTER_REASON_BADGE_ATTRIBUTE}]`);
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
    [${FILTER_ACTION_ATTRIBUTE}="blur"] > :not([${FILTER_REASON_BADGE_ATTRIBUTE}]) {
      filter: blur(10px) !important;
    }
    [${FILTER_REASON_BADGE_ATTRIBUTE}] {
      background: #0f766e !important;
      border-radius: 4px !important;
      color: #ffffff !important;
      display: inline-block !important;
      font-family: Roboto, Arial, sans-serif !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      line-height: 16px !important;
      margin-block-start: 6px !important;
      padding: 3px 6px !important;
    }
  `;
  currentDocument.head?.append(style);
}

export function clearYouTubeCardFilter(element: Element): void {
  element.removeAttribute(FILTER_ACTION_ATTRIBUTE);
  element.removeAttribute(FILTER_REASON_ATTRIBUTE);
  findReasonBadge(element)?.remove();
}

export function applyYouTubeCardFilter(
  candidate: DomMediaCandidate,
  decision: FilterDecision,
  reasonText: string,
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

  const badge = candidate.element.ownerDocument.createElement('span');
  badge.setAttribute(FILTER_REASON_BADGE_ATTRIBUTE, 'true');
  badge.textContent = reasonText;
  badge.title = reasonText;
  candidate.element.append(badge);
}

export function isYouTubeCardFilterCurrent(
  element: Element,
  decision: FilterDecision,
): boolean {
  const action = element.getAttribute(FILTER_ACTION_ATTRIBUTE);
  const hasBadge = findReasonBadge(element) !== null;

  if (decision.action === 'none') {
    return action === null && !hasBadge;
  }

  return (
    action === decision.action &&
    element.getAttribute(FILTER_REASON_ATTRIBUTE) === decision.reason &&
    (decision.action === 'hide' ? !hasBadge : hasBadge)
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
