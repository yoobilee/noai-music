import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { BrowserContext, Page } from '@playwright/test';

import type { FilterMode } from '@/filtering/contracts';

import { readAllowlist, setAllowlist } from './allowlistStorage';
import { setBlocklist } from './blocklistStorage';
import { expect, test } from './fixtures';

const disclosedHtml = await readFile(
  fileURLToPath(
    new URL('../fixtures/youtube/watch-page-data.disclosed.html', import.meta.url),
  ),
  'utf8',
);
const ordinaryHtml = await readFile(
  fileURLToPath(
    new URL('../fixtures/youtube/watch-page-data.ordinary.html', import.meta.url),
  ),
  'utf8',
);
const rowFixtureHtml = await readFile(
  fileURLToPath(
    new URL('../fixtures/youtube-music/card-rows.html', import.meta.url),
  ),
  'utf8',
);

const filterAttribute = 'data-noai-filter-action';
const reasonBadge = '[data-noai-filter-reason-badge]';
const confirmedIds = new Set([
  'SearchAI001',
  'AlbumAI0001',
  'ListAI00001',
  'ArtistAI001',
  'DelayedAI01',
]);

test('direct track block filters an ordinary YTM row without disclosure lookup', async ({ context, page }) => {
  const requested: string[] = [];
  await setSettings(context, true, 'mark');
  await setBlocklist(context, { tracks: [{ videoId: 'SearchOrd01' }] });
  await context.route('https://music.youtube.com/**', (route) => route.fulfill({ body: rowFixtureHtml, contentType: 'text/html' }));
  await context.route('https://www.youtube.com/**', (route) => { requested.push(new URL(route.request().url()).searchParams.get('v') ?? ''); return route.fulfill({ body: ordinaryHtml, contentType: 'text/html' }); });
  await page.goto('https://music.youtube.com/search?q=fixture');
  const row = page.getByTestId('ordinary-row');
  await expect(row).toHaveAttribute(filterAttribute, 'mark');
  await expect(row).toHaveAttribute('data-noai-filter-reason', 'direct-block-track');
  expect(requested).not.toContain('SearchOrd01');
  await setBlocklist(context, {});
  await expect(row).not.toHaveAttribute(filterAttribute);
});

async function setSettings(
  context: BrowserContext,
  enabled: boolean,
  mode: FilterMode,
): Promise<void> {
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async ({ nextEnabled, nextMode }) => {
      const extensionGlobal = globalThis as typeof globalThis & {
        chrome: {
          storage: {
            local: { set(items: Record<string, unknown>): Promise<void> };
          };
        };
      };
      await extensionGlobal.chrome.storage.local.set({
        settingsV1: {
          schemaVersion: 1,
          enabled: nextEnabled,
          mode: nextMode,
          youtubeMusicAutoSkip: false,
        },
      });
    },
    { nextEnabled: enabled, nextMode: mode },
  );
}

async function activateSurface(page: Page, path: string): Promise<void> {
  await page.evaluate((nextPath) => {
    const fixtureWindow = window as typeof window & {
      activateFixtureSurface(path: string): void;
    };
    fixtureWindow.activateFixtureSurface(nextPath);
  }, path);
}

test('filters all supported SPA row surfaces in every mode', async ({
  context,
  page,
}) => {
  const watchRequests = new Map<string, number>();
  await setSettings(context, true, 'hide');
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: rowFixtureHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', async (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v') ?? '';
    watchRequests.set(videoId, (watchRequests.get(videoId) ?? 0) + 1);
    await route.fulfill({
      body: confirmedIds.has(videoId) ? disclosedHtml : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://music.youtube.com/search?q=fixture');
  const surfaces = [
    '/search?q=fixture',
    '/browse/MPREfixture',
    '/playlist?list=PLfixture',
    '/channel/UCaaaaaaaaaaaaaaaaaaaaaa',
  ];

  for (const mode of ['hide', 'blur', 'mark'] as const) {
    await setSettings(context, true, mode);
    for (const path of surfaces) {
      await activateSurface(page, path);
      const confirmed = page.getByTestId('confirmed-row');
      const ordinary = page.getByTestId('ordinary-row');
      await expect(confirmed).toHaveAttribute(filterAttribute, mode);
      await expect(ordinary).not.toHaveAttribute(filterAttribute, /.+/);
      await expect(confirmed.locator(reasonBadge)).toHaveCount(
        mode === 'hide' ? 0 : 1,
      );
      if (mode !== 'hide') {
        await expect(confirmed.locator(`${reasonBadge} > span`)).toHaveText(
          /^NoAI · YouTube AI (?:disclosure|표시)$/,
        );
      }
    }
  }

  for (const videoId of confirmedIds) {
    if (videoId !== 'DelayedAI01') {
      expect(watchRequests.get(videoId)).toBe(1);
    }
  }
  expect([...watchRequests.values()].every((count) => count === 1)).toBe(true);
});

test('clears reused rows and rejects a stale confirmed callback', async ({
  context,
  page,
}) => {
  let releaseDelayed: (() => void) | undefined;
  const delayedMayFinish = new Promise<void>((resolve) => {
    releaseDelayed = resolve;
  });
  let delayedRequests = 0;
  let ordinaryRequests = 0;

  await setSettings(context, true, 'mark');
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: rowFixtureHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', async (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v');
    if (videoId === 'DelayedAI01') {
      delayedRequests += 1;
      await delayedMayFinish;
      await route.fulfill({ body: disclosedHtml, contentType: 'text/html' });
      return;
    }

    ordinaryRequests += 1;
    await route.fulfill({ body: ordinaryHtml, contentType: 'text/html' });
  });

  await page.goto('https://music.youtube.com/search?q=fixture');
  const row = page.getByTestId('confirmed-row');
  await row.locator('.title a').evaluate((link) => {
    link.setAttribute('href', '/watch?v=DelayedAI01');
  });
  await expect.poll(() => delayedRequests).toBe(1);

  await row.locator('.title a').evaluate((link) => {
    link.setAttribute('href', '/watch?v=ReusedOrd01');
  });
  await expect(row).not.toHaveAttribute(filterAttribute, /.+/);
  await expect.poll(() => ordinaryRequests).toBeGreaterThan(1);

  releaseDelayed?.();
  await page.waitForTimeout(100);
  await expect(row).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(row.locator(reasonBadge)).toHaveCount(0);
  expect(delayedRequests).toBe(1);
});

test('keeps one lookup and badge while applying live setting transitions', async ({
  context,
  page,
}) => {
  const requests = new Map<string, number>();
  await setSettings(context, true, 'hide');
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: rowFixtureHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', async (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v') ?? '';
    requests.set(videoId, (requests.get(videoId) ?? 0) + 1);
    await route.fulfill({
      body: confirmedIds.has(videoId) ? disclosedHtml : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://music.youtube.com/search?q=fixture');
  const row = page.getByTestId('confirmed-row');
  await expect(row).toHaveAttribute(filterAttribute, 'hide');

  await setSettings(context, true, 'blur');
  await expect(row).toHaveAttribute(filterAttribute, 'blur');
  await expect(row.locator(reasonBadge)).toHaveCount(1);

  await setSettings(context, true, 'mark');
  await expect(row).toHaveAttribute(filterAttribute, 'mark');
  await expect(row.locator(reasonBadge)).toHaveCount(1);

  await row.evaluate((element) => {
    element.append(document.createElement('span'));
    element.append(document.createElement('span'));
  });
  await expect(row.locator(reasonBadge)).toHaveCount(1);

  await setSettings(context, true, 'hide');
  await expect(row).toHaveAttribute(filterAttribute, 'hide');
  await expect(row.locator(reasonBadge)).toHaveCount(0);

  await setSettings(context, false, 'hide');
  await expect(row).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(row.locator(reasonBadge)).toHaveCount(0);

  await setSettings(context, true, 'mark');
  await expect(row).toHaveAttribute(filterAttribute, 'mark');
  await expect(row.locator(reasonBadge)).toHaveCount(1);
  expect(requests.get('SearchAI001')).toBe(1);
});

test('restores a confirmed row when a track or stable artist is allowed', async ({
  context,
  page,
}) => {
  await setSettings(context, true, 'mark');
  await setAllowlist(context, {});
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: rowFixtureHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v') ?? '';
    return route.fulfill({
      body: confirmedIds.has(videoId) ? disclosedHtml : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://music.youtube.com/search?q=fixture');
  const row = page.getByTestId('confirmed-row');
  await expect(row).toHaveAttribute(filterAttribute, 'mark');

  await row.getByRole('button', { name: /Allow this track|이 곡 허용/ }).click();
  await expect(row).not.toHaveAttribute(filterAttribute, /.+/);
  await expect.poll(() => readAllowlist(context)).toMatchObject({
    tracks: [{ videoId: 'SearchAI001' }],
  });

  await setAllowlist(context, {});
  await expect(row).toHaveAttribute(filterAttribute, 'mark');

  await row
    .getByRole('button', { name: /Allow this artist|이 아티스트 허용/ })
    .click();
  await expect(row).not.toHaveAttribute(filterAttribute, /.+/);
  await expect.poll(() => readAllowlist(context)).toMatchObject({
    artists: [{ artistId: 'UCabcdefghijklmnopqrstuv' }],
  });

  await setAllowlist(context, {});
  await expect(row).toHaveAttribute(filterAttribute, 'mark');
  await expect(row.locator(reasonBadge)).toHaveCount(1);
});
