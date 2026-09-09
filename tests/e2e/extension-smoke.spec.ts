import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test } from './fixtures';

interface GeneratedManifest {
  manifest_version: number;
  permissions?: string[];
  host_permissions?: string[];
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
  await expect(page.getByRole('checkbox')).toBeChecked();
  await expect(page.locator('input[type="radio"][value="hide"]')).toBeChecked();

  await page.locator('input[type="radio"][value="mark"]').check();

  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'NoAI' })).toBeVisible();
  await expect(page.locator('input[type="radio"][value="mark"]')).toBeChecked();
});
