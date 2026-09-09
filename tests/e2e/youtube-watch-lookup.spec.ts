import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

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
const lookupBadge = '[data-noai-development-watch-lookup-badge]';

test('checks card watch pages once and reuses storage.local after reload', async ({
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

  await expect(
    page.getByTestId('disclosed-card-one').locator(lookupBadge),
  ).toHaveText('NoAI dev: disclosure detected');
  await expect(
    page.getByTestId('disclosed-card-two').locator(lookupBadge),
  ).toHaveText('NoAI dev: disclosure detected');
  await expect(page.getByTestId('ordinary-card').locator(lookupBadge)).toHaveText(
    'NoAI dev: no disclosure detected',
  );
  await expect(page.getByTestId('non-video-card').locator(lookupBadge)).toHaveCount(
    0,
  );
  expect(watchRequests).toEqual(
    new Map([
      ['Disclose001', 1],
      ['Ordinary001', 1],
    ]),
  );

  await page.getByTestId('ordinary-card').locator('#video-title').evaluate((link) => {
    link.setAttribute('href', '/watch?v=Disclose001');
  });
  await expect(page.getByTestId('ordinary-card').locator(lookupBadge)).toHaveText(
    'NoAI dev: disclosure detected',
  );

  await page.reload();
  await expect(
    page.getByTestId('disclosed-card-one').locator(lookupBadge),
  ).toHaveText('NoAI dev: disclosure detected');
  expect(watchRequests).toEqual(
    new Map([
      ['Disclose001', 1],
      ['Ordinary001', 1],
    ]),
  );
});
