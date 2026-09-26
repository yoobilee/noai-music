import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type Catalog = Record<string, { message: string }>;

async function readCatalog(locale: 'en' | 'ko'): Promise<Catalog> {
  return JSON.parse(
    await readFile(
      resolve(`src/public/_locales/${locale}/messages.json`),
      'utf8',
    ),
  ) as Catalog;
}

describe('UI locale catalogs', () => {
  it('keeps English and Korean message coverage aligned', async () => {
    const [english, korean] = await Promise.all([
      readCatalog('en'),
      readCatalog('ko'),
    ]);

    expect(Object.keys(english).sort()).toEqual(Object.keys(korean).sort());
    for (const key of [
      'brandName',
      'languageLabel',
      'languageAuto',
      'languageKorean',
      'languageEnglish',
    ]) {
      expect(english[key]?.message).toBeTruthy();
      expect(korean[key]?.message).toBeTruthy();
    }
    expect(english.extName?.message).toBe(
      'NoAI — AI-Labeled Music Filter',
    );
    expect(korean.extName?.message).toBe('NoAI — AI 표시 음악 필터');
    expect(english.brandName?.message).toBe('NoAI');
    expect(korean.brandName?.message).toBe('NoAI');
  });

  it('uses content wording for video IDs and describes Music scope precisely', async () => {
    const [english, korean] = await Promise.all([
      readCatalog('en'),
      readCatalog('ko'),
    ]);
    const keys = [
      'allowThisTrack',
      'addTrackAllowlist',
      'allowedTrackCount',
      'allowedTracksHeading',
      'allowlistDescription',
      'addTrackBlocklist',
      'blockedTrackCount',
      'blockedTracksHeading',
      'directBlockTrackReason',
      'trackAllowlistInputLabel',
      'trackBlocklistInputLabel',
      'youtubeMusicAutoSkipDescription',
      'extDescription',
      'filterScopeMusicDescription',
    ] as const;

    expect(Object.fromEntries(keys.map((key) => [key, korean[key]?.message]))).toEqual({
      allowThisTrack: '이 콘텐츠 허용',
      addTrackAllowlist: '콘텐츠 허용',
      allowedTrackCount: '허용된 콘텐츠 $COUNT$개',
      allowedTracksHeading: '허용된 콘텐츠',
      allowlistDescription:
        '허용한 콘텐츠와 아티스트는 YouTube 공식 AI 표시가 확인되어도 필터링하거나 건너뛰지 않습니다. 사용자가 추가한 ID만 저장합니다.',
      addTrackBlocklist: '콘텐츠 차단',
      blockedTrackCount: '차단된 콘텐츠 $COUNT$개',
      blockedTracksHeading: '차단된 콘텐츠',
      directBlockTrackReason: 'NoAI · 직접 차단한 콘텐츠',
      trackAllowlistInputLabel: 'YouTube video ID 또는 watch URL',
      trackBlocklistInputLabel: 'YouTube video ID 또는 watch URL',
      youtubeMusicAutoSkipDescription:
        '재생 중 정책에 해당하는 콘텐츠를 다음 항목으로 넘깁니다.',
      extDescription:
        'YouTube와 YouTube Music에서 공식 AI·변경 표시가 있는 콘텐츠를 필터링합니다.',
      filterScopeMusicDescription:
        'YouTube가 Music 카테고리로 분류한 콘텐츠에만 AI 표시 필터를 적용합니다.',
    });
    expect(Object.fromEntries(keys.map((key) => [key, english[key]?.message]))).toEqual({
      allowThisTrack: 'Allow this content',
      addTrackAllowlist: 'Allow content',
      allowedTrackCount: 'Allowed content: $COUNT$',
      allowedTracksHeading: 'Allowed content',
      allowlistDescription:
        'Allowed content and artists are not filtered or skipped, even when an official YouTube AI disclosure is confirmed. IDs are stored only when you add them.',
      addTrackBlocklist: 'Block content',
      blockedTrackCount: 'Blocked content: $COUNT$',
      blockedTracksHeading: 'Blocked content',
      directBlockTrackReason: 'NoAI · Directly blocked content',
      trackAllowlistInputLabel: 'YouTube video ID or watch URL',
      trackBlocklistInputLabel: 'YouTube video ID or watch URL',
      youtubeMusicAutoSkipDescription: 'Skip matching content during playback.',
      extDescription:
        'Filter officially labeled AI or altered content on YouTube and YouTube Music.',
      filterScopeMusicDescription:
        'Apply AI-label filtering only to content categorized as Music by YouTube.',
    });
  });
});
