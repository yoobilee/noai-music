import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test } from './fixtures';

const fixturePath = fileURLToPath(
  new URL('../fixtures/youtube/watch-made-with-ai.en.html', import.meta.url),
);
const fixtureHtml = await readFile(fixturePath, 'utf8');
const unknownWatchHtml = await readFile(
  fileURLToPath(
    new URL('../fixtures/youtube/watch-page-data.unknown.html', import.meta.url),
  ),
  'utf8',
);
const fixtureUrl = 'https://www.youtube.com/watch?v=z8Dz-IFFFY4';
const developmentBadge = '[data-noai-development-disclosure-badge]';

test('marks only confirmed disclosure video units once', async ({ context, page }) => {
  await context.route('https://www.youtube.com/**', async (route) => {
    await route.fulfill({
      body: route.request().isNavigationRequest()
        ? fixtureHtml
        : unknownWatchHtml,
      contentType: 'text/html',
      status: 200,
    });
  });

  await page.goto(fixtureUrl);

  const disclosedVideo = page.getByTestId('disclosed-video');
  await expect(disclosedVideo.locator(developmentBadge)).toHaveCount(1);
  await expect(disclosedVideo.locator(developmentBadge)).toHaveText(
    'NoAI: AI disclosure detected',
  );
  await expect(
    page.getByTestId('ordinary-video').locator(developmentBadge),
  ).toHaveCount(0);
  await expect(
    page.getByTestId('similar-user-text-video').locator(developmentBadge),
  ).toHaveCount(0);

  await page.evaluate(() => {
    const disclosed = document.querySelector('[data-testid="disclosed-video"]');
    const badge = disclosed?.querySelector('ytd-badge-supported-renderer');
    if (disclosed && badge) {
      disclosed.append(badge.cloneNode(true));
    }
    history.pushState({}, '', '/watch?v=M7lc1UVf-VE');
    document.dispatchEvent(new Event('yt-navigate-finish'));
  });

  await expect(disclosedVideo.locator(developmentBadge)).toHaveCount(1);

  await page.evaluate(() => {
    const dynamicVideo = document.createElement('ytd-video-renderer');
    dynamicVideo.setAttribute('data-testid', 'dynamic-disclosed-video');
    dynamicVideo.innerHTML = `
      <a id="video-title" href="/watch?v=M7lc1UVf-VE">Dynamic video</a>
      <ytd-badge-supported-renderer>
        <span aria-label="AI: Content was made with AI">AI</span>
      </ytd-badge-supported-renderer>
    `;
    document.body.append(dynamicVideo);
  });

  await expect(
    page.getByTestId('dynamic-disclosed-video').locator(developmentBadge),
  ).toHaveCount(1);

  await page.evaluate(() => {
    document
      .querySelector(
        '[data-testid="dynamic-disclosed-video"] ytd-badge-supported-renderer',
      )
      ?.remove();
  });

  await expect(
    page.getByTestId('dynamic-disclosed-video').locator(developmentBadge),
  ).toHaveCount(0);
});
