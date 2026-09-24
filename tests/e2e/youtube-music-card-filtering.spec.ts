import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { BrowserContext, Page } from '@playwright/test';

import type { FilterMode, FilterScope } from '@/filtering/contracts';

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
  'QueueAI0001',
]);

test('direct track block filters an ordinary YTM row without disclosure lookup', async ({ context, page }) => {
  const requested: string[] = [];
  await setSettings(context, true, 'mark', 'music');
  await setBlocklist(context, { tracks: [{ videoId: 'SearchOrd01' }] });
  await context.route('https://music.youtube.com/**', (route) => route.fulfill({ body: rowFixtureHtml, contentType: 'text/html' }));
  await context.route('https://www.youtube.com/**', (route) => { requested.push(new URL(route.request().url()).searchParams.get('v') ?? ''); return route.fulfill({ body: ordinaryHtml, contentType: 'text/html' }); });
  await page.goto('https://music.youtube.com/search?q=fixture');
  const row = page.getByTestId('ordinary-row');
  await expect(row).toHaveAttribute(filterAttribute, 'mark');
  await expect(row).toHaveAttribute('data-noai-filter-reason', 'direct-block-track');
  expect(requested).not.toContain('SearchOrd01');
  await setSettings(context, true, 'mark', 'all');
  await expect(row).toHaveAttribute(filterAttribute, 'mark');
  await setBlocklist(context, {});
  await expect(row).not.toHaveAttribute(filterAttribute);
});

async function setSettings(
  context: BrowserContext,
  enabled: boolean,
  mode: FilterMode,
  filterScope: FilterScope = 'all',
): Promise<void> {
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async ({ nextEnabled, nextMode, nextFilterScope }) => {
      const extensionGlobal = globalThis as typeof globalThis & {
        chrome: {
          storage: {
            local: { set(items: Record<string, unknown>): Promise<void> };
          };
        };
      };
      await extensionGlobal.chrome.storage.local.set({
        settingsV1: {
          schemaVersion: 2,
          enabled: nextEnabled,
          mode: nextMode,
          filterScope: nextFilterScope,
          youtubeMusicAutoSkip: false,
          uiLocale: 'auto',
        },
      });
    },
    { nextEnabled: enabled, nextMode: mode, nextFilterScope: filterScope },
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
    if (videoId !== 'DelayedAI01' && videoId !== 'QueueAI0001') {
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

test('re-evaluates a cached unknown row on live scope changes', async ({
  context,
  page,
}) => {
  await setSettings(context, true, 'hide', 'all');
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

  await page.goto('https://music.youtube.com/search?q=scope');
  const row = page.getByTestId('confirmed-row');
  await expect(row).toHaveAttribute(filterAttribute, 'hide');

  await setSettings(context, true, 'hide', 'music');
  await expect(row).not.toHaveAttribute(filterAttribute);

  await setSettings(context, true, 'hide', 'all');
  await expect(row).toHaveAttribute(filterAttribute, 'hide');
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

test('reapplies playlist filtering after the live playlist-watch-playlist transition', async ({
  context,
  page,
}) => {
  const requests = new Map<string, number>();
  await setSettings(context, true, 'blur');
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

  await page.goto('https://music.youtube.com/playlist?list=PLfixture');
  let confirmed = page.getByTestId('confirmed-row');
  let ordinary = page.getByTestId('ordinary-row');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'blur');
  await expect(ordinary).not.toHaveAttribute(filterAttribute, /.+/);

  await page.evaluate(async () => {
    const fixtureWindow = window as typeof window & {
      simulatePlaylistPlaybackReturn(): Promise<void>;
    };
    await fixtureWindow.simulatePlaylistPlaybackReturn();
  });
  await expect(page).toHaveURL(/\/playlist\?list=PLfixture$/);
  await expect(confirmed).toHaveAttribute(filterAttribute, 'blur');
  await expect(confirmed.locator(reasonBadge)).toHaveCount(1);
  await expect(ordinary).not.toHaveAttribute(filterAttribute, /.+/);

  await activateSurface(page, '/watch?v=ListOrd0001&list=PLfixture');
  await activateSurface(page, '/playlist?list=PLfixture');
  confirmed = page.getByTestId('confirmed-row');
  ordinary = page.getByTestId('ordinary-row');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'blur');
  await expect(confirmed.locator(reasonBadge)).toHaveCount(1);
  await expect(ordinary).not.toHaveAttribute(filterAttribute, /.+/);

  await setSettings(context, true, 'mark');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'mark');
  await setSettings(context, false, 'mark');
  await expect(confirmed).not.toHaveAttribute(filterAttribute, /.+/);
  await setSettings(context, true, 'blur');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'blur');
  expect(requests.get('ListAI00001')).toBe(1);
});

test('filters live-shaped queue data identities without touching invalid items', async ({
  context,
  page,
}) => {
  const requests: string[] = [];
  await setSettings(context, true, 'blur');
  await setAllowlist(context, {});
  await setBlocklist(context, { tracks: [{ videoId: 'QueueBlk001' }] });
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: rowFixtureHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', async (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v') ?? '';
    requests.push(videoId);
    await route.fulfill({
      body: confirmedIds.has(videoId) ? disclosedHtml : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto(
    'https://music.youtube.com/watch?v=NowPlaying1&list=PLfixture',
  );
  const confirmed = page.getByTestId('queue-confirmed');
  const ordinary = page.getByTestId('queue-ordinary');
  const direct = page.getByTestId('queue-direct');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'blur');
  await expect(confirmed.locator(reasonBadge)).toHaveCount(1);
  await expect(ordinary).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(direct).toHaveAttribute(filterAttribute, 'blur');
  await expect(direct).toHaveAttribute(
    'data-noai-filter-reason',
    'direct-block-track',
  );
  expect(requests).not.toContain('QueueBlk001');
  for (const testId of ['queue-missing', 'queue-invalid', 'queue-ambiguous']) {
    await expect(page.getByTestId(testId)).not.toHaveAttribute(
      filterAttribute,
      /.+/,
    );
  }

  await setAllowlist(context, { tracks: [{ videoId: 'QueueAI0001' }] });
  await expect(confirmed).not.toHaveAttribute(filterAttribute, /.+/);
  await setAllowlist(context, {});
  await expect(confirmed).toHaveAttribute(filterAttribute, 'blur');

  await setSettings(context, true, 'mark');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'mark');
  await expect(confirmed.locator(reasonBadge)).toHaveCount(1);
  await setSettings(context, true, 'hide');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'hide');
  await expect(confirmed).toHaveCSS('display', 'none');
  expect(
    await confirmed.evaluate(
      (element) => element.getBoundingClientRect().height,
    ),
  ).toBe(0);
  expect(
    await confirmed.evaluate((element) => ({
      connected: element.isConnected,
      videoId: (
        element as Element & { data?: { videoId?: unknown } }
      ).data?.videoId,
    })),
  ).toEqual({ connected: true, videoId: 'QueueAI0001' });

  await setSettings(context, false, 'hide');
  await expect(confirmed).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(confirmed).not.toHaveCSS('display', 'none');
  await setSettings(context, true, 'hide');
  await expect(confirmed).toHaveCSS('display', 'none');

  await setSettings(context, true, 'blur');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'blur');
  await expect(confirmed).not.toHaveCSS('display', 'none');
  await setSettings(context, true, 'mark');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'mark');
  await setSettings(context, true, 'hide');
  await expect(confirmed).toHaveCSS('display', 'none');

  await setSettings(context, true, 'mark');
  await expect(confirmed).toHaveAttribute(filterAttribute, 'mark');

  await page.evaluate(() => {
    const fixtureWindow = window as typeof window & {
      reuseFixtureQueueItem(testId: string, videoId: string | null): void;
    };
    fixtureWindow.reuseFixtureQueueItem('queue-ordinary', 'QueueAI0001');
  });
  await expect(ordinary).toHaveAttribute(filterAttribute, 'mark');
  await expect(ordinary.locator(reasonBadge)).toHaveCount(1);
  await page.evaluate(() => {
    const fixtureWindow = window as typeof window & {
      reuseFixtureQueueItem(testId: string, videoId: string | null): void;
    };
    fixtureWindow.reuseFixtureQueueItem('queue-ordinary', 'QueueOrd001');
  });
  await expect(ordinary).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(ordinary.locator(reasonBadge)).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { fixtureNextClicks: number })
          .fixtureNextClicks,
    ),
  ).toBe(0);
});
