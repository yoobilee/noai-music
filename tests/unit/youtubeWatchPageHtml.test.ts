import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseYouTubeWatchPageHtml } from '@/adapters/youtube/watchPageHtml';
import { detectYouTubeOfficialDisclosure } from '@/detection/detectOfficialDisclosure';

const disclosedHtml = await readFile(
  resolve('tests/fixtures/youtube/watch-page-data.disclosed.html'),
  'utf8',
);
const ordinaryHtml = await readFile(
  resolve('tests/fixtures/youtube/watch-page-data.ordinary.html'),
  'utf8',
);
const unknownHtml = await readFile(
  resolve('tests/fixtures/youtube/watch-page-data.unknown.html'),
  'utf8',
);

describe('YouTube watch-page HTML adapter', () => {
  it('extracts deduplicated official evidence from sanitized initial data', () => {
    const parsed = parseYouTubeWatchPageHtml(disclosedHtml);

    expect(parsed.status).toBe('parsed');
    expect(parsed.evidence).toEqual([
      {
        source: 'youtube',
        kind: 'made-with-ai',
        matchedText: 'AI: Content was made with AI',
        confidence: 'confirmed',
        location: 'metadata-badge',
        evidenceType: 'accessibility-label',
      },
      {
        source: 'youtube',
        kind: 'made-with-ai',
        matchedText: 'Made with AI',
        confidence: 'confirmed',
        location: 'expanded-description',
        evidenceType: 'official-support-link',
      },
    ]);
    expect(detectYouTubeOfficialDisclosure(parsed.evidence).detected).toBe(true);
  });

  it('returns a parsed empty result for a recognized ordinary watch page', () => {
    const parsed = parseYouTubeWatchPageHtml(ordinaryHtml);

    expect(parsed).toEqual({ status: 'parsed', evidence: [] });
    expect(detectYouTubeOfficialDisclosure(parsed.evidence).detected).toBe(false);
  });

  it('reuses the confirmed Korean disclosure profiles', () => {
    const koreanHtml = disclosedHtml
      .replaceAll('AI: Content was made with AI', 'AI: AI로 생성된 콘텐츠')
      .replace('How this was made', '콘텐츠 생성 방식')
      .replace('Made with AI', 'AI로 제작')
      .replace(
        'Sounds or visuals were altered or fully generated.',
        '사운드 또는 영상이 변경되었거나 새롭게 생성되었습니다.',
      );

    const parsed = parseYouTubeWatchPageHtml(koreanHtml);
    expect(parsed.status).toBe('parsed');
    expect(detectYouTubeOfficialDisclosure(parsed.evidence).detected).toBe(true);
  });

  it('keeps missing, incomplete and malformed initial data unknown', () => {
    expect(parseYouTubeWatchPageHtml('<html></html>')).toMatchObject({
      status: 'unknown',
      reason: 'initial-data-missing',
    });
    expect(parseYouTubeWatchPageHtml(unknownHtml)).toMatchObject({
      status: 'unknown',
      reason: 'watch-page-structure-missing',
    });
    expect(
      parseYouTubeWatchPageHtml('<script>var ytInitialData = {broken};</script>'),
    ).toMatchObject({ status: 'unknown', reason: 'initial-data-invalid' });
  });

  it('does not inspect disclosure-like data outside the primary video or engagement panels', () => {
    const html = ordinaryHtml.replace(
      '"engagementPanels": []',
      `"recommendations": [{"metadataBadgeRenderer": {
        "accessibilityData": {"label": "AI: Content was made with AI"}
      }}], "engagementPanels": []`,
    );

    expect(parseYouTubeWatchPageHtml(html)).toEqual({
      status: 'parsed',
      evidence: [],
    });
  });

  it('keeps an unrecognized official disclosure component indeterminate', () => {
    const html = ordinaryHtml.replace(
      '"engagementPanels": []',
      `"engagementPanels": [{"howThisWasMadeSectionViewModel": {
        "bodyHeader": {"content": "Unrecognized disclosure"},
        "urlEndpoint": {"url": "https://support.google.com/youtube/answer/15447836"}
      }}]`,
    );

    const parsed = parseYouTubeWatchPageHtml(html);
    expect(parsed).toMatchObject({
      status: 'unknown',
      reason: 'unrecognized-disclosure',
    });
    expect(parsed.evidence).toMatchObject([
      { kind: 'unknown', confidence: 'indeterminate' },
    ]);
  });
});
