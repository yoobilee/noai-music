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
  const disclosure = page.locator('.allowlist-manager__disclosure');
  const summary = page.locator('.allowlist-manager__disclosure > summary');

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
