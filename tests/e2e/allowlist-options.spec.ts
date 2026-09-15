import { expect, test } from './fixtures';

test('adds, deduplicates and removes stable track and artist identities', async ({
  context,
  extensionId,
  page,
}) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  const trackInput = page.locator('#allowlist-track-input');
  await trackInput.fill('track title');
  await trackInput.press('Enter');
  await expect(trackInput).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#allowlist-track-error')).toBeVisible();

  await trackInput.fill('https://music.youtube.com/watch?v=TrackVideo1');
  await trackInput.press('Enter');
  await expect(page.getByText('TrackVideo1', { exact: true })).toBeVisible();

  await trackInput.fill('TrackVideo1');
  await trackInput.press('Enter');
  await expect(page.getByText('TrackVideo1', { exact: true })).toHaveCount(1);

  const artistInput = page.locator('#allowlist-artist-input');
  const artistId = 'UCabcdefghijklmnopqrstuv';
  await artistInput.fill(`https://music.youtube.com/browse/${artistId}`);
  await artistInput.press('Enter');
  await expect(page.getByText(artistId, { exact: true })).toBeVisible();

  const removeTrack = page.getByRole('button', {
    name: /(?:Remove|삭제): TrackVideo1/,
  });
  await removeTrack.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('TrackVideo1', { exact: true })).toHaveCount(0);

  await page
    .getByRole('button', { name: new RegExp(`(?:Remove|삭제): ${artistId}`) })
    .click();
  await expect(page.getByText(artistId, { exact: true })).toHaveCount(0);

  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const extensionGlobal = globalThis as typeof globalThis & {
          chrome: {
            storage: {
              local: { get(key: string): Promise<Record<string, unknown>> };
            };
          };
        };
        return extensionGlobal.chrome.storage.local.get('allowlistV1');
      }),
    )
    .toEqual({
      allowlistV1: { schemaVersion: 1, tracks: [], artists: [] },
    });
});
