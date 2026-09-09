import type { OfficialDisclosureEvidence } from '@/detection/contracts';

import {
  createDescriptionDisclosureEvidence,
  createMetadataBadgeEvidence,
  deduplicateDisclosureEvidence,
  isOfficialDisclosureHelpUrl,
} from './disclosureEvidence';

const MAX_WATCH_PAGE_HTML_LENGTH = 5_000_000;
const INITIAL_DATA_MARKERS = [
  'var ytInitialData =',
  'window["ytInitialData"] =',
  "window['ytInitialData'] =",
] as const;

type JsonObject = Record<string, unknown>;

export type YouTubeWatchPageParseResult =
  | {
      status: 'parsed';
      evidence: readonly OfficialDisclosureEvidence[];
    }
  | {
      status: 'unknown';
      reason:
        | 'html-too-large'
        | 'initial-data-missing'
        | 'initial-data-invalid'
        | 'watch-page-structure-missing'
        | 'unrecognized-disclosure';
      evidence: readonly OfficialDisclosureEvidence[];
    };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractJsonObject(html: string, start: number): string | null {
  let openingBrace = start;
  while (/\s/.test(html[openingBrace] ?? '')) {
    openingBrace += 1;
  }
  if (html[openingBrace] !== '{') {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = openingBrace; index < html.length; index += 1) {
    const character = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return html.slice(openingBrace, index + 1);
      }
    }
  }

  return null;
}

function readInitialData(html: string): JsonObject | null {
  for (const marker of INITIAL_DATA_MARKERS) {
    let markerIndex = html.indexOf(marker);

    while (markerIndex !== -1) {
      const jsonText = extractJsonObject(html, markerIndex + marker.length);
      if (jsonText !== null) {
        try {
          const parsed: unknown = JSON.parse(jsonText);
          if (isObject(parsed)) {
            return parsed;
          }
        } catch {
          // A later assignment can still contain valid initial data.
        }
      }

      markerIndex = html.indexOf(marker, markerIndex + marker.length);
    }
  }

  return null;
}

function findObjectsByKey(root: unknown, targetKey: string): JsonObject[] {
  const matches: JsonObject[] = [];
  const pending: unknown[] = [root];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== 'object' || current === null || visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (key === targetKey && isObject(value)) {
        matches.push(value);
      }
      pending.push(value);
    }
  }

  return matches;
}

function readNestedString(root: JsonObject, path: readonly string[]): string {
  let current: unknown = root;
  for (const key of path) {
    if (!isObject(current)) {
      return '';
    }
    current = current[key];
  }
  return typeof current === 'string' ? current : '';
}

function readNestedValue(root: JsonObject, path: readonly string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (!isObject(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function collectDisplayText(root: unknown): string {
  const values: string[] = [];
  const pending: unknown[] = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    if (!isObject(current)) {
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (
        typeof value === 'string' &&
        ['content', 'label', 'simpleText', 'text'].includes(key)
      ) {
        values.push(value);
      } else if (typeof value === 'object' && value !== null) {
        pending.push(value);
      }
    }
  }

  return values.join(' ');
}

function containsOfficialHelpUrl(root: unknown): boolean {
  const pending: unknown[] = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    if (!isObject(current)) {
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (
        key === 'url' &&
        typeof value === 'string' &&
        isOfficialDisclosureHelpUrl(value)
      ) {
        return true;
      }
      if (typeof value === 'object' && value !== null) {
        pending.push(value);
      }
    }
  }

  return false;
}

function readPrimaryBadgeEvidence(
  primaryInfo: JsonObject,
): OfficialDisclosureEvidence[] {
  const evidence: OfficialDisclosureEvidence[] = [];

  for (const badge of findObjectsByKey(primaryInfo.badges, 'metadataBadgeRenderer')) {
    const accessibilityLabel =
      readNestedString(badge, ['accessibilityData', 'label']) ||
      readNestedString(badge, [
        'accessibilityData',
        'accessibilityData',
        'label',
      ]);
    const matchedEvidence = createMetadataBadgeEvidence(accessibilityLabel);
    if (matchedEvidence) {
      evidence.push(matchedEvidence);
    }
  }

  return evidence;
}

function readDescriptionEvidence(initialData: JsonObject): OfficialDisclosureEvidence[] {
  const evidence: OfficialDisclosureEvidence[] = [];
  const engagementPanels = initialData.engagementPanels;

  for (const disclosure of findObjectsByKey(
    engagementPanels,
    'howThisWasMadeSectionViewModel',
  )) {
    const matchedEvidence = createDescriptionDisclosureEvidence(
      collectDisplayText(disclosure),
      containsOfficialHelpUrl(disclosure),
    );
    if (matchedEvidence) {
      evidence.push(matchedEvidence);
    }
  }

  return evidence;
}

export function parseYouTubeWatchPageHtml(
  html: string,
): YouTubeWatchPageParseResult {
  if (html.length > MAX_WATCH_PAGE_HTML_LENGTH) {
    return { status: 'unknown', reason: 'html-too-large', evidence: [] };
  }

  const hasInitialDataMarker = INITIAL_DATA_MARKERS.some((marker) =>
    html.includes(marker),
  );
  const initialData = readInitialData(html);
  if (initialData === null) {
    return {
      status: 'unknown',
      reason: hasInitialDataMarker
        ? 'initial-data-invalid'
        : 'initial-data-missing',
      evidence: [],
    };
  }

  const primaryContents = readNestedValue(initialData, [
    'contents',
    'twoColumnWatchNextResults',
    'results',
    'results',
    'contents',
  ]);
  const primaryInfo = Array.isArray(primaryContents)
    ? primaryContents
        .map((item) =>
          isObject(item) && isObject(item.videoPrimaryInfoRenderer)
            ? item.videoPrimaryInfoRenderer
            : undefined,
        )
        .find((item) => item !== undefined)
    : undefined;
  if (primaryInfo === undefined) {
    return {
      status: 'unknown',
      reason: 'watch-page-structure-missing',
      evidence: [],
    };
  }

  const evidence = deduplicateDisclosureEvidence([
    ...readPrimaryBadgeEvidence(primaryInfo),
    ...readDescriptionEvidence(initialData),
  ]);

  if (evidence.some(({ confidence }) => confidence === 'indeterminate')) {
    return {
      status: 'unknown',
      reason: 'unrecognized-disclosure',
      evidence,
    };
  }

  return { status: 'parsed', evidence };
}
