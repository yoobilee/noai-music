import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test } from './fixtures';

interface GeneratedManifest {
  manifest_version: number;
  permissions?: string[];
  host_permissions?: string[];
  options_ui?: {
    page?: string;
    open_in_tab?: boolean;
  };
  content_scripts?: Array<{ matches?: string[] }>;
}

const manifestPath = fileURLToPath(
  new URL('../../.output/chrome-mv3/manifest.json', import.meta.url),
);

test('generated manifest stays on MV3 with minimal permissions', async () => {
  const manifest = JSON.parse(
    await readFile(manifestPath, 'utf8'),
  ) as GeneratedManifest;

  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(['storage']);
  expect(manifest.host_permissions).toEqual(['https://www.youtube.com/*']);
  expect(manifest.host_permissions).not.toContain('<all_urls>');
  expect(manifest.options_ui).toEqual({
    open_in_tab: false,
    page: 'options.html',
  });
  expect(
    manifest.content_scripts?.flatMap((contentScript) =>
      contentScript.matches ?? [],
    ),
  ).toEqual([
    'https://music.youtube.com/*',
    'https://www.youtube.com/*',
  ]);
});

test('popup and options entrypoints load', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('heading', { name: 'NoAI' })).toBeVisible();
  await expect(page.locator('#noai-enabled')).toBeChecked();
  await expect(page.locator('#noai-youtube-music-auto-skip')).toBeChecked();
  await expect(page.locator('input[type="radio"][value="hide"]')).toBeChecked();

  await page.locator('input[type="radio"][value="mark"]').check();

  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'NoAI' })).toBeVisible();
  await expect(page.locator('input[type="radio"][value="mark"]')).toBeChecked();
});

test('popup manages the allowlist without opening another page', async ({
  context,
  extensionId,
  page,
}) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  const initialPageCount = context.pages().length;
  const disclosure = page.locator('.allowlist-manager--compact:not(.blocklist-manager) .allowlist-manager__disclosure');
  const summary = disclosure.locator('> summary');

  await expect(summary).toContainText(/Allowed tracks: 0|허용된 곡 0개/);
  await expect(summary).toContainText(/Allowed artists: 0|허용된 아티스트 0명/);
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');

  const trackInput = page.locator('#allowlist-track-input');
  await trackInput.fill('track title');
  await trackInput.press('Enter');
  await expect(trackInput).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#allowlist-track-error')).toBeVisible();

  await trackInput.fill('TrackVideo1');
  await trackInput.press('Enter');
  await expect(summary).toContainText(/Allowed tracks: 1|허용된 곡 1개/);
  await page
    .getByRole('button', { name: /(?:Remove|삭제): TrackVideo1/ })
    .click();
  await expect(summary).toContainText(/Allowed tracks: 0|허용된 곡 0개/);

  const artistId = 'UCabcdefghijklmnopqrstuv';
  const artistInput = page.locator('#allowlist-artist-input');
  await artistInput.fill(artistId);
  await artistInput.press('Enter');
  await expect(summary).toContainText(
    /Allowed artists: 1|허용된 아티스트 1명/,
  );
  await page
    .getByRole('button', { name: new RegExp(`(?:Remove|삭제): ${artistId}`) })
    .click();
  await expect(summary).toContainText(/Allowed artists: 0|허용된 아티스트 0명/);

  expect(context.pages()).toHaveLength(initialPageCount);
  await expect(page).toHaveURL(`chrome-extension://${extensionId}/popup.html`);
});

test('popup manages track, artist, and channel direct block rules', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  const summary = page.locator('.blocklist-manager__disclosure > summary');
  await expect(summary).toContainText(/Blocked tracks: 0|차단된 곡 0개/);
  await expect(summary.locator('.allowlist-manager__chevron')).toBeVisible();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.blocklist-manager__disclosure')).toHaveAttribute('open', '');

  await page.locator('#blocklist-track-input').fill('TrackVideo1');
  await page.locator('form:has(#blocklist-track-input) button').click();
  await expect(summary).toContainText(/Blocked tracks: 1|차단된 곡 1개/);
  await page.locator('#blocklist-track-input').fill('TrackVideo1');
  await page.locator('form:has(#blocklist-track-input) button').click();
  await expect(summary).toContainText(/Blocked tracks: 1|차단된 곡 1개/);
  const channel = 'UCabcdefghijklmnopqrstuv';
  await page.locator('#blocklist-artist-input').fill(channel);
  await page.locator('form:has(#blocklist-artist-input) button').click();
  await page.locator('#blocklist-channel-input').fill('https://www.youtube.com/%40%EB%B8%94%EB%A3%A8%EB%A0%88%EC%9D%B8');
  await page.locator('form:has(#blocklist-channel-input) button').click();
  await expect(summary).toContainText(/Blocked artists: 1|차단된 아티스트 1명/);
  await expect(summary).toContainText(/Blocked channels: 1|차단된 채널 1개/);
  await expect(page.locator('.blocklist-manager code', { hasText: '@블루레인' })).toHaveCount(1);
  await expect(page.locator('body')).toHaveCSS('overflow-y', 'auto');

  await page.locator('#blocklist-track-input').fill('not-an-id');
  await page.locator('form:has(#blocklist-track-input) button').click();
  await expect(page.locator('#blocklist-track-input')).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: /(?:Remove|삭제): TrackVideo1/ }).click();
  await expect(summary).toContainText(/Blocked tracks: 0|차단된 곡 0개/);
});
