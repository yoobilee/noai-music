import type {
  OfficialDisclosureEvidence,
  OfficialDisclosureKind,
} from '@/detection/contracts';

import { YOUTUBE_SELECTORS } from './selectors';

const CURRENT_DISCLOSURE_LABELS = new Map<string, OfficialDisclosureKind>([
  ['ai: content was made with ai', 'made-with-ai'],
  ['ai: ai로 생성된 콘텐츠', 'made-with-ai'],
]);

interface DescriptionDisclosureProfile {
  kind: OfficialDisclosureKind;
  header: string;
  body: string;
}

const DESCRIPTION_DISCLOSURE_PROFILES: readonly DescriptionDisclosureProfile[] =
  [
    {
      kind: 'made-with-ai',
      header: 'Made with AI',
      body: 'Sounds or visuals were altered or fully generated.',
    },
    {
      kind: 'made-with-ai',
      header: 'AI로 제작',
      body: '사운드 또는 영상이 변경되었거나 새롭게 생성되었습니다.',
    },
    {
      kind: 'altered-or-synthetic-content',
      header: 'Altered or synthetic content',
      body: 'Sound or visuals were significantly edited or digitally generated.',
    },
  ];

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function evidenceFingerprint(evidence: OfficialDisclosureEvidence): string {
  return [
    evidence.kind,
    evidence.matchedText.toLocaleLowerCase(),
    evidence.location,
    evidence.evidenceType,
  ].join('|');
}

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
      const matchedText = normalizeText(
        labelledElement.getAttribute('aria-label') ?? '',
      );
      const kind = CURRENT_DISCLOSURE_LABELS.get(
        matchedText.toLocaleLowerCase(),
      );

      if (kind) {
        evidence.push({
          source: 'youtube',
          kind,
          matchedText,
          confidence: 'confirmed',
          location: 'metadata-badge',
          evidenceType: 'accessibility-label',
        });
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
    if (!disclosure.querySelector(YOUTUBE_SELECTORS.officialDisclosureHelpLink)) {
      continue;
    }

    const sectionText = normalizeText(disclosure.textContent ?? '');
    const normalizedSectionText = sectionText.toLocaleLowerCase();
    const matchingProfile = DESCRIPTION_DISCLOSURE_PROFILES.find(
      ({ header, body }) =>
        normalizedSectionText.includes(header.toLocaleLowerCase()) &&
        normalizedSectionText.includes(body.toLocaleLowerCase()),
    );

    evidence.push({
      source: 'youtube',
      kind: matchingProfile?.kind ?? 'unknown',
      matchedText: matchingProfile?.header ?? sectionText,
      confidence: matchingProfile ? 'confirmed' : 'indeterminate',
      location: 'expanded-description',
      evidenceType: 'official-support-link',
    });
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
    const uniqueEvidence = new Map<string, OfficialDisclosureEvidence>();

    for (const item of evidence) {
      uniqueEvidence.set(evidenceFingerprint(item), item);
    }

    return [...uniqueEvidence.values()];
  } catch {
    return [];
  }
}
