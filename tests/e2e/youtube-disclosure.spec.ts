import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test } from './fixtures';

const fixtureHtml = await readFile(
  fileURLToPath(
    new URL('../fixtures/youtube/watch-made-with-ai.en.html', import.meta.url),
  ),
  'utf8',
);
const unknownWatchHtml = await readFile(
  fileURLToPath(
    new URL('../fixtures/youtube/watch-page-data.unknown.html', import.meta.url),
  ),
  'utf8',
);
const fixtureUrl = 'https://www.youtube.com/watch?v=z8Dz-IFFFY4';
const filterAttribute = 'data-noai-filter-action';

test('filters a card with direct official evidence but not watch metadata', async ({
  context,
  page,
}) => {
  await context.route('https://www.youtube.com/**', async (route) => {
    await route.fulfill({
      body: route.request().isNavigationRequest() ? fixtureHtml : unknownWatchHtml,
      contentType: 'text/html',
      status: 200,
    });
  });

  await page.goto(fixtureUrl);

  await expect(page.getByTestId('disclosed-video')).not.toHaveAttribute(
    filterAttribute,
    /.+/,
  );
  await expect(page.getByTestId('ordinary-video')).not.toHaveAttribute(
    filterAttribute,
    /.+/,
  );
  await expect(page.getByTestId('similar-user-text-video')).not.toHaveAttribute(
    filterAttribute,
    /.+/,
  );

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

  const dynamic = page.getByTestId('dynamic-disclosed-video');
  await expect(dynamic).toHaveAttribute(filterAttribute, 'hide');

  await dynamic
    .locator('ytd-badge-supported-renderer')
    .evaluate((element) => element.remove());
  await expect(dynamic).not.toHaveAttribute(filterAttribute, /.+/);
});
