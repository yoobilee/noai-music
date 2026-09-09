import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { BrowserContext } from '@playwright/test';

import type { FilterMode } from '@/filtering/contracts';

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
const cardPageHtml = `<!doctype html>
<html lang="en">
  <body>
    <ytd-video-renderer data-testid="disclosed-card-one">
      <a id="video-title" href="/watch?v=Disclose001">Disclosed fixture</a>
    </ytd-video-renderer>
    <ytd-video-renderer data-testid="disclosed-card-two">
      <a id="video-title" href="/watch?v=Disclose001">Repeated fixture</a>
    </ytd-video-renderer>
    <ytd-video-renderer data-testid="ordinary-card">
      <a id="video-title" href="/watch?v=Ordinary001">Ordinary fixture</a>
    </ytd-video-renderer>
    <ytd-video-renderer data-testid="non-video-card">
      <a id="video-title" href="/channel/sanitized">Channel link</a>
    </ytd-video-renderer>
  </body>
</html>`;
const filterAttribute = 'data-noai-filter-action';
const reasonBadge = '[data-noai-filter-reason-badge]';

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
        },
      });
    },
    { nextEnabled: enabled, nextMode: mode },
  );
}

test('filters only confirmed cards and switches modes without reloading', async ({
  context,
  page,
}) => {
  const watchRequests = new Map<string, number>();

  await context.route('https://www.youtube.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.isNavigationRequest()) {
      await route.fulfill({ body: cardPageHtml, contentType: 'text/html' });
      return;
    }

    const videoId = url.searchParams.get('v') ?? '';
    watchRequests.set(videoId, (watchRequests.get(videoId) ?? 0) + 1);
    await route.fulfill({
      body: videoId === 'Disclose001' ? disclosedHtml : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://www.youtube.com/results?search_query=sanitized');

  const first = page.getByTestId('disclosed-card-one');
  const second = page.getByTestId('disclosed-card-two');
  const ordinary = page.getByTestId('ordinary-card');
  await expect(first).toHaveAttribute(filterAttribute, 'hide');
  await expect(second).toHaveAttribute(filterAttribute, 'hide');
  await expect(first).toBeHidden();
  await expect(ordinary).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(page.getByTestId('non-video-card')).not.toHaveAttribute(
    filterAttribute,
    /.+/,
  );
  expect(watchRequests).toEqual(
    new Map([
      ['Disclose001', 1],
      ['Ordinary001', 1],
    ]),
  );

  await second.locator('#video-title').evaluate((link) => {
    link.setAttribute('href', '/watch?v=Ordinary001');
  });
  await expect(second).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(second).toBeVisible();

  await setSettings(context, true, 'mark');
  await expect(first).toHaveAttribute(filterAttribute, 'mark');
  await expect(first).toBeVisible();
  await expect(first.locator(reasonBadge)).toHaveText(
    'NoAI · YouTube AI disclosure',
  );

  await setSettings(context, true, 'blur');
  await expect(first).toHaveAttribute(filterAttribute, 'blur');
  await expect(first.locator(reasonBadge)).toHaveCount(1);

  await setSettings(context, false, 'blur');
  await expect(first).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(first.locator(reasonBadge)).toHaveCount(0);
  await expect(first).toBeVisible();
  await expect(ordinary).not.toHaveAttribute(filterAttribute, /.+/);

  await page.reload();
  await expect(page.getByTestId('disclosed-card-one')).not.toHaveAttribute(
    filterAttribute,
    /.+/,
  );
  expect(watchRequests).toEqual(
    new Map([
      ['Disclose001', 1],
      ['Ordinary001', 1],
    ]),
  );
});

test('reuses cache and clears a reused card before a stale result arrives', async ({
  context,
  page,
}) => {
  let releaseDisclosed: (() => void) | undefined;
  const disclosedMayFinish = new Promise<void>((resolve) => {
    releaseDisclosed = resolve;
  });
  let disclosedRequests = 0;
  let ordinaryRequests = 0;

  await context.route('https://www.youtube.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.isNavigationRequest()) {
      await route.fulfill({
        body: cardPageHtml.replaceAll('Disclose001', 'DelayedAI01'),
        contentType: 'text/html',
      });
      return;
    }

    const videoId = url.searchParams.get('v');
    if (videoId === 'DelayedAI01') {
      disclosedRequests += 1;
      await disclosedMayFinish;
      await route.fulfill({ body: disclosedHtml, contentType: 'text/html' });
      return;
    }

    ordinaryRequests += 1;
    await route.fulfill({ body: ordinaryHtml, contentType: 'text/html' });
  });

  await page.goto('https://www.youtube.com/results?search_query=stale');
  await expect.poll(() => disclosedRequests).toBe(1);

  const reused = page.getByTestId('disclosed-card-one');
  await reused.locator('#video-title').evaluate((link) => {
    link.setAttribute('href', '/watch?v=Ordinary001');
  });
  await expect.poll(() => ordinaryRequests).toBeGreaterThan(0);
  await expect(reused).not.toHaveAttribute(filterAttribute, /.+/);

  releaseDisclosed?.();
  await expect.poll(() => disclosedRequests).toBe(1);
  await expect(reused).not.toHaveAttribute(filterAttribute, /.+/);
});
