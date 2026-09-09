import type { OfficialDisclosureEvidence } from '@/detection/contracts';

import {
  createDescriptionDisclosureEvidence,
  createMetadataBadgeEvidence,
  deduplicateDisclosureEvidence,
  isOfficialDisclosureHelpUrl,
} from './disclosureEvidence';
import { YOUTUBE_SELECTORS } from './selectors';

function readMetadataBadgeEvidence(
  root: Element,
): readonly OfficialDisclosureEvidence[] {
  const evidence: OfficialDisclosureEvidence[] = [];

  for (const badge of root.querySelectorAll(
    YOUTUBE_SELECTORS.officialMetadataBadge,
  )) {
    const labelledElements = badge.matches('[aria-label]')
      ? [badge]
      : [...badge.querySelectorAll('[aria-label]')];

    for (const labelledElement of labelledElements) {
      const matchedEvidence = createMetadataBadgeEvidence(
        labelledElement.getAttribute('aria-label') ?? '',
      );

      if (matchedEvidence) {
        evidence.push(matchedEvidence);
      }
    }
  }

  return evidence;
}

function readDescriptionEvidence(
  root: Element,
): readonly OfficialDisclosureEvidence[] {
  const evidence: OfficialDisclosureEvidence[] = [];

  for (const disclosure of root.querySelectorAll(
    YOUTUBE_SELECTORS.howThisWasMade,
  )) {
    const hasOfficialHelpLink = [
      ...disclosure.querySelectorAll<HTMLAnchorElement>(
        YOUTUBE_SELECTORS.officialDisclosureHelpLink,
      ),
    ].some((link) =>
      isOfficialDisclosureHelpUrl(link.getAttribute('href') ?? ''),
    );
    if (!hasOfficialHelpLink) {
      continue;
    }

    const matchedEvidence = createDescriptionDisclosureEvidence(
      disclosure.textContent ?? '',
      true,
    );

    if (matchedEvidence) {
      evidence.push(matchedEvidence);
    }
  }

  return evidence;
}

export function readYouTubeOfficialDisclosures(
  root: Element,
): readonly OfficialDisclosureEvidence[] {
  try {
    const evidence = [
      ...readMetadataBadgeEvidence(root),
      ...readDescriptionEvidence(root),
    ];
    return deduplicateDisclosureEvidence(evidence);
  } catch {
    return [];
  }
}
