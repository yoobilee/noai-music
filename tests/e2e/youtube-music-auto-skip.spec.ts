import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { BrowserContext } from '@playwright/test';

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
): Promise<void> {
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async (autoSkip) => {
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
        enabled: true,
        mode: 'hide',
        youtubeMusicAutoSkip: autoSkip,
      },
    });
  }, youtubeMusicAutoSkip);
}

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
  await page.getByTestId('current-track').evaluate((link) => {
    link.setAttribute('href', '/watch?v=PlaybackB01');
  });
  await expect(page.getByTestId('current-track')).toHaveAttribute(
    'href',
    '/watch?v=PlaybackB01',
  );
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
