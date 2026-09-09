import type {
  OfficialDisclosureEvidence,
  OfficialDisclosureKind,
} from '@/detection/contracts';

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

export function normalizeDisclosureText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function createMetadataBadgeEvidence(
  accessibilityLabel: string,
): OfficialDisclosureEvidence | null {
  const matchedText = normalizeDisclosureText(accessibilityLabel);
  const kind = CURRENT_DISCLOSURE_LABELS.get(matchedText.toLocaleLowerCase());

  return kind
    ? {
        source: 'youtube',
        kind,
        matchedText,
        confidence: 'confirmed',
        location: 'metadata-badge',
        evidenceType: 'accessibility-label',
      }
    : null;
}

export function isOfficialDisclosureHelpUrl(value: string): boolean {
  try {
    const url = new URL(value, 'https://www.youtube.com/');
    return (
      url.protocol === 'https:' &&
      url.hostname === 'support.google.com' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/youtube/answer/15447836'
    );
  } catch {
    return false;
  }
}

export function createDescriptionDisclosureEvidence(
  text: string,
  hasOfficialHelpLink: boolean,
): OfficialDisclosureEvidence | null {
  if (!hasOfficialHelpLink) {
    return null;
  }

  const sectionText = normalizeDisclosureText(text);
  const normalizedSectionText = sectionText.toLocaleLowerCase();
  const matchingProfile = DESCRIPTION_DISCLOSURE_PROFILES.find(
    ({ header, body }) =>
      normalizedSectionText.includes(header.toLocaleLowerCase()) &&
      normalizedSectionText.includes(body.toLocaleLowerCase()),
  );

  return {
    source: 'youtube',
    kind: matchingProfile?.kind ?? 'unknown',
    matchedText: matchingProfile?.header ?? sectionText.slice(0, 500),
    confidence: matchingProfile ? 'confirmed' : 'indeterminate',
    location: 'expanded-description',
    evidenceType: 'official-support-link',
  };
}

function evidenceFingerprint(evidence: OfficialDisclosureEvidence): string {
  return [
    evidence.kind,
    evidence.matchedText.toLocaleLowerCase(),
    evidence.location,
    evidence.evidenceType,
  ].join('|');
}

export function deduplicateDisclosureEvidence(
  evidence: readonly OfficialDisclosureEvidence[],
): readonly OfficialDisclosureEvidence[] {
  const uniqueEvidence = new Map<string, OfficialDisclosureEvidence>();

  for (const item of evidence) {
    uniqueEvidence.set(evidenceFingerprint(item), item);
  }

  return [...uniqueEvidence.values()];
}
