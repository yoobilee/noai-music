import type {
  DetectionResult,
  OfficialDisclosureEvidence,
} from './contracts';

const SUPPORTED_DISCLOSURE_KINDS = new Set([
  'made-with-ai',
  'altered-or-synthetic-content',
]);

function evidenceFingerprint(evidence: OfficialDisclosureEvidence): string {
  return [
    evidence.source,
    evidence.kind,
    evidence.matchedText.toLocaleLowerCase(),
    evidence.confidence,
    evidence.location,
    evidence.evidenceType,
  ].join('|');
}

export function detectYouTubeOfficialDisclosure(
  evidence: readonly OfficialDisclosureEvidence[],
): DetectionResult {
  const uniqueEvidence = new Map<string, OfficialDisclosureEvidence>();

  for (const item of evidence) {
    uniqueEvidence.set(evidenceFingerprint(item), item);
  }

  const normalizedEvidence = [...uniqueEvidence.values()];
  const confirmedEvidence = normalizedEvidence.filter(
    (item) =>
      item.source === 'youtube' &&
      item.confidence === 'confirmed' &&
      SUPPORTED_DISCLOSURE_KINDS.has(item.kind),
  );

  if (confirmedEvidence.length > 0) {
    return {
      detected: true,
      source: 'youtube',
      reason: 'youtube-official-ai-disclosure',
      evidence: confirmedEvidence,
    };
  }

  return {
    detected: false,
    source: 'youtube',
    reason: 'no-confirmed-youtube-official-disclosure',
    evidence: normalizedEvidence,
  };
}
