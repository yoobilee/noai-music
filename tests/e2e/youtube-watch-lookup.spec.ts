import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { BrowserContext } from '@playwright/test';

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
      <ytd-channel-name id="channel-name"><a href="/channel/UCabcdefghijklmnopqrstuv">Synthetic channel</a></ytd-channel-name>
    </ytd-video-renderer>
    <ytd-rich-item-renderer data-testid="handle-card">
      <div id="content">
        <yt-lockup-view-model>
          <div class="ytLockupViewModelHost">
            <a class="ytLockupViewModelContentImage" href="/watch?v=HandleVid01">
              <yt-thumbnail-view-model><div class="ytThumbnailViewModelImage">Thumbnail</div></yt-thumbnail-view-model>
            </a>
            <div class="ytLockupViewModelMetadata">
              <a id="video-title" href="/watch?v=HandleVid01">Handle fixture</a>
              <ytd-channel-name id="channel-name"><a href="/@example">Handle channel</a></ytd-channel-name>
            </div>
          </div>
        </yt-lockup-view-model>
      </div>
    </ytd-rich-item-renderer>
    <ytd-video-renderer data-testid="non-video-card">
      <a id="video-title" href="/channel/sanitized">Channel link</a>
    </ytd-video-renderer>
  </body>
</html>`;
const channelVideosPageHtml = `<!doctype html>
<html lang="en">
  <head>
    <style>
      ytd-rich-item-renderer { display: block; margin-block-end: 16px; }
      yt-thumbnail-view-model { display: block; min-block-size: 80px; position: relative; }
    </style>
  </head>
  <body>
    <ytd-rich-item-renderer data-testid="channel-ordinary-card">
      <div id="content">
        <yt-lockup-view-model>
          <div class="ytLockupViewModelHost">
            <a class="ytLockupViewModelContentImage" href="/watch?v=ChannelOwn1">
              <yt-thumbnail-view-model><div class="ytThumbnailViewModelImage">Thumbnail</div></yt-thumbnail-view-model>
            </a>
            <div class="ytLockupViewModelMetadata">
              <a id="video-title" href="/watch?v=ChannelOwn1">Channel ordinary fixture</a>
            </div>
          </div>
        </yt-lockup-view-model>
      </div>
    </ytd-rich-item-renderer>
    <ytd-rich-item-renderer data-testid="channel-disclosed-card">
      <div id="content">
        <yt-lockup-view-model>
          <div class="ytLockupViewModelHost">
            <a class="ytLockupViewModelContentImage" href="/watch?v=ChannelAI01">
              <yt-thumbnail-view-model><div class="ytThumbnailViewModelImage">Thumbnail</div></yt-thumbnail-view-model>
            </a>
            <div class="ytLockupViewModelMetadata">
              <a id="video-title" href="/watch?v=ChannelAI01">Channel disclosed fixture</a>
            </div>
          </div>
        </yt-lockup-view-model>
      </div>
    </ytd-rich-item-renderer>
  </body>
</html>`;
const filterAttribute = 'data-noai-filter-action';
const reasonBadge = '[data-noai-filter-reason-badge]';

test('direct track blocks ordinary YouTube cards without disclosure and allowlist wins', async ({ context, page }) => {
  const requested: string[] = [];
  await setSettings(context, true, 'mark');
  await setBlocklist(context, { tracks: [{ videoId: 'Ordinary001' }] });
  await context.route('https://www.youtube.com/**', async (route) => {
    if (route.request().isNavigationRequest()) return route.fulfill({ body: cardPageHtml, contentType: 'text/html' });
    requested.push(new URL(route.request().url()).searchParams.get('v') ?? '');
    return route.fulfill({ body: ordinaryHtml, contentType: 'text/html' });
  });
  await page.goto('https://www.youtube.com/');
  const card = page.getByTestId('ordinary-card');
  await expect(card).toHaveAttribute(filterAttribute, 'mark');
  await expect(card).toHaveAttribute('data-noai-filter-reason', 'direct-block-track');
  await expect(card.locator(`${reasonBadge} > span`)).toContainText(/Blocked track|직접 차단한 곡/);
  expect(requested).not.toContain('Ordinary001');
  await setAllowlist(context, { tracks: [{ videoId: 'Ordinary001' }] });
  await expect(card).not.toHaveAttribute(filterAttribute);
});

test('direct channel block uses the stable YouTube channel identity', async ({ context, page }) => {
  await setSettings(context, true, 'mark');
  await setAllowlist(context, {});
  await setBlocklist(context, { channels: [{ identityType: 'channel-id', channelId: 'UCabcdefghijklmnopqrstuv' }] });
  await context.route('https://www.youtube.com/**', (route) => route.fulfill({ body: route.request().isNavigationRequest() ? cardPageHtml : ordinaryHtml, contentType: 'text/html' }));
  await page.goto('https://www.youtube.com/results?search_query=fixture');
  const card = page.getByTestId('ordinary-card');
  await expect(card).toHaveAttribute('data-noai-filter-reason', 'direct-block-channel');
  await expect(card.locator(`${reasonBadge} > span`)).toContainText(/Blocked channel|직접 차단한 채널/);
});

test('exact handle channel block survives modes and hover mutation, then restores on removal', async ({ context, page }) => {
  await setAllowlist(context, {});
  await setSettings(context, true, 'hide');
  await setBlocklist(context, { channels: [{ identityType: 'handle', handle: '@example' }] });
  await context.route('https://www.youtube.com/**', (route) => route.fulfill({ body: route.request().isNavigationRequest() ? cardPageHtml : ordinaryHtml, contentType: 'text/html' }));
  await page.goto('https://www.youtube.com/');
  const card = page.getByTestId('handle-card');
  await expect(card).toHaveAttribute(filterAttribute, 'hide');

  await setSettings(context, true, 'blur');
  await expect(card).toHaveAttribute(filterAttribute, 'blur');
  const badge = card.locator(reasonBadge);
  await expect(badge.locator('> span')).toContainText(/Blocked channel|직접 차단한 채널/);
  const badgeIdentity = await badge.evaluate((element) => {
    (window as typeof window & { noaiHandleBadge?: Element }).noaiHandleBadge = element;
    return true;
  });
  expect(badgeIdentity).toBe(true);
  await card.locator('.ytThumbnailViewModelImage').evaluate((element) => element.append(document.createElement('span')));
  await expect.poll(() => card.evaluate((element) => element.querySelector('[data-noai-filter-reason-badge]') === (window as typeof window & { noaiHandleBadge?: Element }).noaiHandleBadge)).toBe(true);
  await expect(card.locator(reasonBadge)).toHaveCount(1);

  await setSettings(context, true, 'mark');
  await expect(card).toHaveAttribute(filterAttribute, 'mark');
  await expect(card).toHaveAttribute('data-noai-filter-reason', 'direct-block-channel');
  await setBlocklist(context, {});
  await expect(card).not.toHaveAttribute(filterAttribute);
  await expect(card.locator(reasonBadge)).toHaveCount(0);
});

test('channel Videos route fallback applies direct reason and restores official policy after removal', async ({ context, page }) => {
  const watchRequests: string[] = [];
  await setAllowlist(context, {});
  await setSettings(context, true, 'hide');
  await setBlocklist(context, {
    channels: [{ identityType: 'handle', handle: '@example' }],
  });
  await context.route('https://www.youtube.com/**', async (route) => {
    const request = route.request();
    if (request.isNavigationRequest()) {
      await route.fulfill({
        body: channelVideosPageHtml,
        contentType: 'text/html',
      });
      return;
    }
    const videoId = new URL(request.url()).searchParams.get('v') ?? '';
    watchRequests.push(videoId);
    await route.fulfill({
      body: videoId === 'ChannelAI01' ? disclosedHtml : ordinaryHtml,
      contentType: 'text/html',
    });
  });

  await page.goto('https://www.youtube.com/@example/videos');
  const ordinary = page.getByTestId('channel-ordinary-card');
  const disclosed = page.getByTestId('channel-disclosed-card');
  await expect(ordinary).toHaveAttribute(filterAttribute, 'hide');
  await expect(disclosed).toHaveAttribute(filterAttribute, 'hide');
  await expect(ordinary).toHaveAttribute(
    'data-noai-filter-reason',
    'direct-block-channel',
  );
  expect(watchRequests).toEqual([]);

  await setSettings(context, true, 'blur');
  await expect(ordinary).toHaveAttribute(filterAttribute, 'blur');
  await expect(ordinary.locator(`${reasonBadge} > span`)).toContainText(
    /Blocked channel|직접 차단한 채널/,
  );
  const badge = ordinary.locator(reasonBadge);
  await badge.evaluate((element) => {
    (window as typeof window & { noaiRouteBadge?: Element }).noaiRouteBadge =
      element;
  });
  await ordinary
    .locator('.ytThumbnailViewModelImage')
    .evaluate((element) => element.append(document.createElement('span')));
  await expect
    .poll(() =>
      ordinary.evaluate(
        (element) =>
          element.querySelector('[data-noai-filter-reason-badge]') ===
          (window as typeof window & { noaiRouteBadge?: Element })
            .noaiRouteBadge,
      ),
    )
    .toBe(true);
  await expect(ordinary.locator(reasonBadge)).toHaveCount(1);

  await setSettings(context, true, 'mark');
  await expect(ordinary).toHaveAttribute(filterAttribute, 'mark');
  await expect(disclosed).toHaveAttribute(
    'data-noai-filter-reason',
    'direct-block-channel',
  );

  await setBlocklist(context, {});
  await expect(ordinary).not.toHaveAttribute(filterAttribute, /.+/);
  await expect(disclosed).toHaveAttribute(filterAttribute, 'mark');
  await expect(disclosed).toHaveAttribute(
    'data-noai-filter-reason',
    'youtube-official-ai-disclosure',
  );
  await expect(disclosed.locator(`${reasonBadge} > span`)).toHaveText(
    /^NoAI · YouTube AI (?:disclosure|표시)$/,
  );
  await expect.poll(() => [...watchRequests].sort()).toEqual([
    'ChannelAI01',
    'ChannelOwn1',
  ]);
});

test('channel Videos route fallback follows SPA route changes without stale identity', async ({ context, page }) => {
  await setAllowlist(context, {});
  await setSettings(context, true, 'mark');
  await setBlocklist(context, {
    channels: [{ identityType: 'handle', handle: '@channel-a' }],
  });
  await context.route('https://www.youtube.com/**', (route) =>
    route.fulfill({
      body: route.request().isNavigationRequest()
        ? channelVideosPageHtml
        : ordinaryHtml,
      contentType: 'text/html',
    }),
  );

  await page.goto('https://www.youtube.com/@channel-a/videos');
  const card = page.getByTestId('channel-ordinary-card');
  await expect(card).toHaveAttribute(
    'data-noai-filter-reason',
    'direct-block-channel',
  );

  await page.evaluate(() => {
    history.pushState({}, '', '/@channel-b/videos');
    document.dispatchEvent(new Event('yt-navigate-finish'));
  });
  await expect(card).not.toHaveAttribute(filterAttribute, /.+/);

  await page.evaluate(() => {
    history.pushState({}, '', '/@channel-a/videos');
    document.dispatchEvent(new Event('yt-navigate-finish'));
  });
  await expect(card).toHaveAttribute(
    'data-noai-filter-reason',
    'direct-block-channel',
  );
  await expect(card.locator(reasonBadge)).toHaveCount(1);
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
      ['HandleVid01', 1],
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
      ['HandleVid01', 1],
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
