import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { BrowserContext } from '@playwright/test';

import type { FilterMode } from '@/filtering/contracts';

import { readAllowlist, setAllowlist } from './allowlistStorage';
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
  <head>
    <style>
      ytd-rich-item-renderer, ytd-video-renderer {
        display: block;
        margin-block-end: 16px;
      }
      ytd-thumbnail, yt-thumbnail-view-model {
        display: block;
        min-block-size: 80px;
        position: relative;
      }
    </style>
  </head>
  <body>
    <ytd-rich-item-renderer data-testid="disclosed-card-one">
      <div id="content">
        <yt-lockup-view-model>
          <div class="ytLockupViewModelHost">
            <a class="ytLockupViewModelContentImage" href="/watch?v=Disclose001">
              <yt-thumbnail-view-model>
                <div class="ytThumbnailViewModelImage">Thumbnail</div>
              </yt-thumbnail-view-model>
            </a>
            <div class="ytLockupViewModelMetadata">
              <a id="video-title" href="/watch?v=Disclose001">Disclosed fixture</a>
            </div>
          </div>
        </yt-lockup-view-model>
      </div>
    </ytd-rich-item-renderer>
    <ytd-rich-item-renderer data-testid="disclosed-card-two">
      <div id="content">
        <yt-lockup-view-model>
          <div class="ytLockupViewModelHost">
            <a class="ytLockupViewModelContentImage" href="/watch?v=Disclose001">
              <yt-thumbnail-view-model>
                <div class="ytThumbnailViewModelImage">Thumbnail</div>
              </yt-thumbnail-view-model>
            </a>
            <div class="ytLockupViewModelMetadata">
              <a id="video-title" href="/watch?v=Disclose001">Repeated fixture</a>
            </div>
          </div>
        </yt-lockup-view-model>
      </div>
    </ytd-rich-item-renderer>
    <ytd-video-renderer data-testid="ordinary-card">
      <ytd-thumbnail>
        <a id="thumbnail" href="/watch?v=Ordinary001">Thumbnail</a>
      </ytd-thumbnail>
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

  await setSettings(context, true, 'blur');
  await expect(first).toHaveAttribute(filterAttribute, 'blur');
  await expect(first).toBeVisible();
  await expect(first.locator(`${reasonBadge} > span`)).toHaveText(
    /^NoAI · YouTube AI (?:disclosure|표시)$/,
  );
  await expect(first.locator(reasonBadge)).toHaveCSS('position', 'absolute');
  expect(
    await first
      .locator(reasonBadge)
      .evaluate((badge) => badge.parentElement?.tagName),
  ).toBe('YT-THUMBNAIL-VIEW-MODEL');
  expect(
    await first.locator(reasonBadge).evaluate((badge) =>
      badge.parentElement === badge.closest('[data-noai-filter-action]'),
    ),
  ).toBe(false);
  await expect(
    first.locator('.ytThumbnailViewModelImage'),
  ).not.toHaveCSS('filter', 'none');
  await expect(first.locator('.ytLockupViewModelMetadata')).not.toHaveCSS(
    'filter',
    'none',
  );

  const hoverMutationResult = await first.evaluate(async (card) => {
    const badge = card.querySelector('[data-noai-filter-reason-badge]');
    const thumbnail = card.querySelector('yt-thumbnail-view-model');
    const metadata = card.querySelector('.ytLockupViewModelMetadata');
    if (
      !(badge instanceof HTMLElement) ||
      !(thumbnail instanceof HTMLElement) ||
      !(metadata instanceof HTMLElement)
    ) {
      throw new Error('Expected filter overlay fixture elements.');
    }

    const beforeBounds = {
      card: card.getBoundingClientRect().height,
      metadata: metadata.getBoundingClientRect().height,
      thumbnail: thumbnail.getBoundingClientRect().height,
    };
    const beforeFilterState = {
      action: card.getAttribute('data-noai-filter-action'),
      anchorCount: card.querySelectorAll('[data-noai-filter-overlay-anchor]')
        .length,
      pathCount: card.querySelectorAll('[data-noai-filter-overlay-path]').length,
    };

    let filterAttributeChanges = 0;
    let badgeWasRemoved = false;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName?.startsWith('data-noai-filter')
        ) {
          filterAttributeChanges += 1;
        }
        for (const removed of mutation.removedNodes) {
          if (removed === badge || (removed instanceof Element && removed.contains(badge))) {
            badgeWasRemoved = true;
          }
        }
      }
    });
    observer.observe(card, { attributes: true, childList: true, subtree: true });

    const hoverOverlay = document.createElement('div');
    hoverOverlay.setAttribute('data-testid', 'synthetic-hover-overlay');
    thumbnail.append(hoverOverlay);
    await new Promise((resolve) => setTimeout(resolve, 100));
    observer.disconnect();

    return {
      afterBounds: {
        card: card.getBoundingClientRect().height,
        metadata: metadata.getBoundingClientRect().height,
        thumbnail: thumbnail.getBoundingClientRect().height,
      },
      afterFilterState: {
        action: card.getAttribute('data-noai-filter-action'),
        anchorCount: card.querySelectorAll('[data-noai-filter-overlay-anchor]')
          .length,
        pathCount: card.querySelectorAll('[data-noai-filter-overlay-path]').length,
      },
      badgeCount: card.querySelectorAll('[data-noai-filter-reason-badge]').length,
      badgeIsSame: card.querySelector('[data-noai-filter-reason-badge]') === badge,
      badgeWasRemoved,
      beforeBounds,
      beforeFilterState,
      filterAttributeChanges,
    };
  });
  await expect(first.getByTestId('synthetic-hover-overlay')).toBeAttached();
  expect(hoverMutationResult).toEqual({
    afterBounds: hoverMutationResult.beforeBounds,
    afterFilterState: hoverMutationResult.beforeFilterState,
    badgeCount: 1,
    badgeIsSame: true,
    badgeWasRemoved: false,
    beforeBounds: hoverMutationResult.beforeBounds,
    beforeFilterState: {
      action: 'blur',
      anchorCount: 1,
      pathCount: 0,
    },
    filterAttributeChanges: 0,
  });

  await setSettings(context, true, 'mark');
  await expect(first).toHaveAttribute(filterAttribute, 'mark');
  await expect(first.locator(reasonBadge)).toHaveCount(1);

  await setSettings(context, true, 'hide');
  await expect(first).toHaveAttribute(filterAttribute, 'hide');
  await expect(first).toBeHidden();

  await setSettings(context, false, 'hide');
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

test('restores an allowed YouTube card and refilters it after removal', async ({
  context,
  page,
}) => {
  await setSettings(context, true, 'mark');
  await setAllowlist(context, {});
  await context.route('https://www.youtube.com/**', async (route) => {
    const request = route.request();
    const videoId = new URL(request.url()).searchParams.get('v') ?? '';
    await route.fulfill({
      body: request.isNavigationRequest()
        ? cardPageHtml
        : videoId === 'Disclose001' || videoId === 'OtherConf01'
          ? disclosedHtml
          : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://www.youtube.com/results?search_query=allowlist');
  const first = page.getByTestId('disclosed-card-one');
  const second = page.getByTestId('disclosed-card-two');
  await expect(first).toHaveAttribute(filterAttribute, 'mark');
  await expect(second).toHaveAttribute(filterAttribute, 'mark');

  await first
    .getByRole('button', { name: /Allow this track|이 곡 허용/ })
    .click();
  await expect(first).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(second).not.toHaveAttribute(filterAttribute, /.+/);
  await expect.poll(() => readAllowlist(context)).toMatchObject({
    tracks: [{ videoId: 'Disclose001' }],
  });

  await second.locator('#video-title').evaluate((link) => {
    link.setAttribute('href', '/watch?v=OtherConf01');
  });
  await expect(second).toHaveAttribute(filterAttribute, 'mark');
  await expect(first).not.toHaveAttribute(filterAttribute, /.+/);

  await setAllowlist(context, {});
  await expect(first).toHaveAttribute(filterAttribute, 'mark');
  await expect(second).toHaveAttribute(filterAttribute, 'mark');
  await expect(first.locator(reasonBadge)).toHaveCount(1);
});
