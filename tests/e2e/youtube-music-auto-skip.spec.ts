import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { BrowserContext } from '@playwright/test';

import type { FilterScope } from '@/filtering/contracts';

import { setAllowlist } from './allowlistStorage';
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
const playerHtml = await readFile(
  fileURLToPath(
    new URL('../fixtures/youtube-music/auto-skip-player.html', import.meta.url),
  ),
  'utf8',
);

async function setAutoSkip(
  context: BrowserContext,
  youtubeMusicAutoSkip: boolean,
  filterScope: FilterScope = 'all',
): Promise<void> {
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async ({ autoSkip, nextFilterScope }) => {
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
        enabled: true,
        mode: 'blur',
        filterScope: nextFilterScope,
        youtubeMusicAutoSkip: autoSkip,
        uiLocale: 'auto',
      },
    });
  }, { autoSkip: youtubeMusicAutoSkip, nextFilterScope: filterScope });
}

async function transitionCurrentTrack(
  page: import('@playwright/test').Page,
  videoId: string,
  updatePlayerAnchor = false,
): Promise<void> {
  await page.evaluate(
    ({ nextVideoId, updateAnchor }) => {
      const fixtureWindow = window as typeof window & {
        simulateCurrentTrackTransition(
          videoId: string,
          updatePlayerAnchor?: boolean,
        ): void;
      };
      fixtureWindow.simulateCurrentTrackTransition(nextVideoId, updateAnchor);
    },
    { nextVideoId: videoId, updateAnchor: updatePlayerAnchor },
  );
}

test('direct blocked current track skips before disclosure lookup', async ({ context, page }) => {
  const requested: string[] = [];
  await setAutoSkip(context, true);
  await setBlocklist(context, { tracks: [{ videoId: 'PlaybackA01' }] });
  await context.route('https://music.youtube.com/**', (route) => route.fulfill({ body: playerHtml, contentType: 'text/html' }));
  await context.route('https://www.youtube.com/**', (route) => { requested.push(new URL(route.request().url()).searchParams.get('v') ?? ''); return route.fulfill({ body: ordinaryHtml, contentType: 'text/html' }); });
  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '1');
  expect(requested).not.toContain('PlaybackA01');
});

test('skips sequential confirmed tracks once and keeps an ordinary track', async ({
  context,
  page,
}) => {
  const requestedVideoIds: string[] = [];
  await setAutoSkip(context, true);
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v') ?? '';
    requestedVideoIds.push(videoId);
    return route.fulfill({
      body:
        videoId === 'PlaybackA01' || videoId === 'PlaybackB01'
          ? disclosedHtml
          : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');

  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '2');
  await expect(page.getByTestId('current-track')).toHaveAttribute(
    'href',
    '/watch?v=PlaybackC01',
  );
  await expect.poll(() => requestedVideoIds.length).toBe(3);
  expect(requestedVideoIds).toEqual([
    'PlaybackA01',
    'PlaybackB01',
    'PlaybackC01',
  ]);
});

test('manual Next route transition skips a confirmed next track exactly once', async ({
  context,
  page,
}) => {
  const requested = new Map<string, number>();
  await setAutoSkip(context, true);
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v') ?? '';
    requested.set(videoId, (requested.get(videoId) ?? 0) + 1);
    return route.fulfill({
      body: videoId === 'PlaybackB01' ? disclosedHtml : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await expect(page.getByTestId('next-queue-item')).toHaveAttribute(
    'data-noai-filter-action',
    'blur',
  );
  await transitionCurrentTrack(page, 'PlaybackB01');

  await expect(page.locator('body')).toHaveAttribute(
    'data-next-click-count',
    '1',
  );
  await expect(page).toHaveURL(/\/watch\?v=PlaybackC01$/);
  await page.getByTestId('current-track').evaluate((link) => {
    link.append(document.createElement('span'));
  });
  await page.waitForTimeout(100);
  await expect(page.locator('body')).toHaveAttribute(
    'data-next-click-count',
    '1',
  );
  expect(requested.get('PlaybackB01')).toBe(1);
});

test('discards a stale confirmed lookup after the current track changes', async ({
  context,
  page,
}) => {
  let releaseFirstLookup: (() => void) | undefined;
  const firstLookupMayFinish = new Promise<void>((resolve) => {
    releaseFirstLookup = resolve;
  });
  let firstLookupStarted = false;
  await setAutoSkip(context, true);
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', async (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v');
    if (videoId === 'PlaybackA01') {
      firstLookupStarted = true;
      await firstLookupMayFinish;
      await route.fulfill({ body: disclosedHtml, contentType: 'text/html' });
      return;
    }
    await route.fulfill({ body: ordinaryHtml, contentType: 'text/html' });
  });

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await expect.poll(() => firstLookupStarted).toBe(true);
  await transitionCurrentTrack(page, 'PlaybackB01');
  await expect(page).toHaveURL(/\/watch\?v=PlaybackB01$/);
  releaseFirstLookup?.();

  await page.waitForTimeout(250);
  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '0');
});

test('applies the auto-skip setting without reloading YouTube Music', async ({
  context,
  page,
}) => {
  await setAutoSkip(context, false);
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v');
    return route.fulfill({
      body: videoId === 'PlaybackA01' ? disclosedHtml : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await page.waitForTimeout(100);
  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '0');

  await setAutoSkip(context, true);
  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '1');
});

test('re-evaluates a confirmed unknown track when scope changes to all', async ({
  context,
  page,
}) => {
  await setAutoSkip(context, true, 'music');
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) =>
    route.fulfill({ body: disclosedHtml, contentType: 'text/html' }),
  );

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await page.waitForTimeout(100);
  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '0');

  await setAutoSkip(context, true, 'all');
  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '1');
});

test('does not skip an allowed track and applies removal on the next generation', async ({
  context,
  page,
}) => {
  await setAutoSkip(context, true);
  await setAllowlist(context, { tracks: [{ videoId: 'PlaybackA01' }] });
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) =>
    route.fulfill({ body: disclosedHtml, contentType: 'text/html' }),
  );

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await page.waitForTimeout(100);
  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '0');

  await setAllowlist(context, {});
  await page.waitForTimeout(100);
  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '0');

  await transitionCurrentTrack(page, 'PlaybackB01');
  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '1');
});

test('manual transition honors auto-skip off and an allowlisted next track', async ({
  context,
  page,
}) => {
  await setAutoSkip(context, false);
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v');
    return route.fulfill({
      body: videoId === 'PlaybackB01' ? disclosedHtml : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await expect(page.getByTestId('next-queue-item')).toHaveAttribute(
    'data-noai-filter-action',
    'blur',
  );
  await transitionCurrentTrack(page, 'PlaybackB01');
  await page.waitForTimeout(100);
  await expect(page.locator('body')).toHaveAttribute(
    'data-next-click-count',
    '0',
  );

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await setAutoSkip(context, true);
  await setAllowlist(context, { tracks: [{ videoId: 'PlaybackB01' }] });
  await transitionCurrentTrack(page, 'PlaybackB01');
  await page.waitForTimeout(100);
  await expect(page.locator('body')).toHaveAttribute(
    'data-next-click-count',
    '0',
  );
});

test('manual transition skips a direct-blocked next track without disclosure lookup', async ({
  context,
  page,
}) => {
  const requested: string[] = [];
  await setAutoSkip(context, true);
  await setBlocklist(context, { tracks: [{ videoId: 'PlaybackB01' }] });
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) => {
    requested.push(
      new URL(route.request().url()).searchParams.get('v') ?? '',
    );
    return route.fulfill({ body: ordinaryHtml, contentType: 'text/html' });
  });

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await expect(page.getByTestId('next-queue-item')).toHaveAttribute(
    'data-noai-filter-reason',
    'direct-block-track',
  );
  await transitionCurrentTrack(page, 'PlaybackB01');
  await expect(page.locator('body')).toHaveAttribute(
    'data-next-click-count',
    '1',
  );
  await expect(page).toHaveURL(/\/watch\?v=PlaybackC01$/);
  expect(requested).not.toContain('PlaybackB01');
});

test('manual transition keeps an ordinary next track', async ({
  context,
  page,
}) => {
  await setAutoSkip(context, true);
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) =>
    route.fulfill({ body: ordinaryHtml, contentType: 'text/html' }),
  );

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await transitionCurrentTrack(page, 'PlaybackB01');
  await page.waitForTimeout(100);
  await expect(page.locator('body')).toHaveAttribute(
    'data-next-click-count',
    '0',
  );
  await expect(page).toHaveURL(/\/watch\?v=PlaybackB01$/);
});

test('discards a pending next-track result after a later manual transition', async ({
  context,
  page,
}) => {
  let releaseNextLookup: (() => void) | undefined;
  const nextLookupMayFinish = new Promise<void>((resolve) => {
    releaseNextLookup = resolve;
  });
  let nextLookupStarted = false;
  await setAutoSkip(context, true);
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', async (route) => {
    const videoId = new URL(route.request().url()).searchParams.get('v');
    if (videoId === 'PlaybackB01') {
      nextLookupStarted = true;
      await nextLookupMayFinish;
      await route.fulfill({ body: disclosedHtml, contentType: 'text/html' });
      return;
    }
    await route.fulfill({ body: ordinaryHtml, contentType: 'text/html' });
  });

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await expect.poll(() => nextLookupStarted).toBe(true);
  await transitionCurrentTrack(page, 'PlaybackB01');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await transitionCurrentTrack(page, 'PlaybackC01');
  releaseNextLookup?.();
  await page.waitForTimeout(150);

  await expect(page.locator('body')).toHaveAttribute(
    'data-next-click-count',
    '0',
  );
  await expect(page).toHaveURL(/\/watch\?v=PlaybackC01$/);
});

test('does not skip a track with an allowed stable artist identity', async ({
  context,
  page,
}) => {
  await setAutoSkip(context, true);
  await setAllowlist(context, {
    artists: [{ artistId: 'UCabcdefghijklmnopqrstuv' }],
  });
  await context.route('https://music.youtube.com/**', (route) =>
    route.fulfill({ body: playerHtml, contentType: 'text/html' }),
  );
  await context.route('https://www.youtube.com/**', (route) =>
    route.fulfill({ body: disclosedHtml, contentType: 'text/html' }),
  );

  await page.goto('https://music.youtube.com/watch?v=PlaybackA01');
  await page.waitForTimeout(100);

  await expect(page.locator('body')).toHaveAttribute('data-next-click-count', '0');
});
