import type { DomMediaCandidate } from '@/adapters/contracts';
import type { DetectionResult } from '@/detection/contracts';

export const DEVELOPMENT_BADGE_ATTRIBUTE =
  'data-noai-development-disclosure-badge';

const DEVELOPMENT_BADGE_TEXT = 'NoAI: AI disclosure detected';

function findExistingBadge(candidate: DomMediaCandidate): Element | null {
  return candidate.element.querySelector(`[${DEVELOPMENT_BADGE_ATTRIBUTE}]`);
}

export function hasYouTubeDevelopmentBadge(
  candidate: DomMediaCandidate,
): boolean {
  return findExistingBadge(candidate) !== null;
}

export function renderYouTubeDevelopmentBadge(
  candidate: DomMediaCandidate,
  detection: DetectionResult,
): void {
  const existingBadge = findExistingBadge(candidate);

  if (!detection.detected) {
    existingBadge?.remove();
    return;
  }

  if (existingBadge) {
    return;
  }

  const badge = candidate.element.ownerDocument.createElement('span');
  badge.setAttribute(DEVELOPMENT_BADGE_ATTRIBUTE, 'true');
  badge.setAttribute(
    'aria-label',
    'NoAI development marker: YouTube AI disclosure detected',
  );
  badge.title =
    "Development-only marker based on YouTube's official disclosure UI.";
  badge.textContent = DEVELOPMENT_BADGE_TEXT;

  Object.assign(badge.style, {
    background: '#0f766e',
    borderRadius: '4px',
    color: '#ffffff',
    display: 'inline-block',
    fontFamily: 'Roboto, Arial, sans-serif',
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: '16px',
    marginBlockStart: '6px',
    padding: '3px 6px',
  });

  candidate.element.append(badge);
}
