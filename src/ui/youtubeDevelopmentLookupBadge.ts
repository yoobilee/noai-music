import type { DomMediaCandidate } from '@/adapters/contracts';
import type { WatchDisclosureStatus } from '@/shared/youtubeWatchDisclosure';

export const DEVELOPMENT_LOOKUP_BADGE_ATTRIBUTE =
  'data-noai-development-watch-lookup-badge';

type DevelopmentLookupStatus = WatchDisclosureStatus | 'checking';

const STATUS_TEXT: Readonly<Record<DevelopmentLookupStatus, string>> = {
  checking: 'NoAI dev: checking disclosure',
  confirmed: 'NoAI dev: disclosure detected',
  'not-detected': 'NoAI dev: no disclosure detected',
  'unknown-or-error': 'NoAI dev: disclosure status unknown',
};

function findExistingBadge(candidate: DomMediaCandidate): HTMLElement | null {
  return candidate.element.querySelector<HTMLElement>(
    `[${DEVELOPMENT_LOOKUP_BADGE_ATTRIBUTE}]`,
  );
}

export function hasYouTubeDevelopmentLookupBadge(
  candidate: DomMediaCandidate,
): boolean {
  return findExistingBadge(candidate) !== null;
}

export function removeYouTubeDevelopmentLookupBadge(
  candidate: DomMediaCandidate,
): void {
  findExistingBadge(candidate)?.remove();
}

export function renderYouTubeDevelopmentLookupBadge(
  candidate: DomMediaCandidate,
  status: DevelopmentLookupStatus,
): void {
  const badge =
    findExistingBadge(candidate) ??
    candidate.element.ownerDocument.createElement('span');

  badge.setAttribute(DEVELOPMENT_LOOKUP_BADGE_ATTRIBUTE, status);
  badge.setAttribute(
    'aria-label',
    `NoAI development marker: ${STATUS_TEXT[status]}`,
  );
  badge.title =
    'Development-only watch-page disclosure lookup status. This is not a claim that the music itself was AI-generated.';
  badge.textContent = STATUS_TEXT[status];

  Object.assign(badge.style, {
    background: status === 'confirmed' ? '#0f766e' : '#4b5563',
    borderRadius: '4px',
    color: '#ffffff',
    display: 'inline-block',
    fontFamily: 'Roboto, Arial, sans-serif',
    fontSize: '11px',
    fontWeight: '500',
    lineHeight: '15px',
    marginBlockStart: '4px',
    padding: '2px 5px',
  });

  if (!badge.isConnected) {
    candidate.element.append(badge);
  }
}
