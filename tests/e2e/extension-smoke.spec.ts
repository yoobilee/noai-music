import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test } from './fixtures';

interface GeneratedManifest {
  manifest_version: number;
  version: string;
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
  expect(manifest.version).toBe('0.9.0');
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

test('popup defines a stable intrinsic width and its own scroll container', async ({
  extensionId,
  page,
}) => {
  await page.setViewportSize({ height: 600, width: 190 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('heading', { name: 'NoAI' })).toBeVisible();

  const intrinsicWidths = await page.evaluate(() => ({
    body: getComputedStyle(document.body).inlineSize,
    document: getComputedStyle(document.documentElement).inlineSize,
    panel: getComputedStyle(
      document.querySelector<HTMLElement>('.settings-panel--compact')!,
    ).inlineSize,
    root: getComputedStyle(document.querySelector<HTMLElement>('#root')!)
      .inlineSize,
  }));
  expect(intrinsicWidths).toEqual({
    body: '380px',
    document: '380px',
    panel: '380px',
    root: '380px',
  });

  await page.setViewportSize({ height: 600, width: 380 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'NoAI' })).toBeVisible();

  const modeCards = page.locator('.mode-option');
  const cardBoxes = await modeCards.evaluateAll((cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top, width: rect.width };
    }),
  );
  expect(cardBoxes.every((box) => box.width > 90)).toBe(true);
  expect(new Set(cardBoxes.map((box) => Math.round(box.top))).size).toBe(1);
  expect(
    await page
      .locator('.settings-panel__header > div')
      .evaluate((copy) => copy.clientWidth),
  ).toBeGreaterThan(200);

  const sampleWidths = () =>
    page.evaluate(async () => {
      const values: number[][] = [];
      for (let index = 0; index < 16; index += 1) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        values.push([
          document.documentElement.getBoundingClientRect().width,
          document.body.getBoundingClientRect().width,
          document.querySelector('#root')!.getBoundingClientRect().width,
          document
            .querySelector('.settings-panel--compact')!
            .getBoundingClientRect().width,
        ]);
      }
      return values;
    });

  const collapsedWidths = await sampleWidths();
  expect(new Set(collapsedWidths.map((sample) => sample.join(':'))).size).toBe(
    1,
  );
  expect(collapsedWidths[0]).toEqual([380, 380, 380, 380]);

  await page.locator('.user-rule-manager__disclosure').evaluateAll((items) => {
    for (const item of items) (item as HTMLDetailsElement).open = true;
  });
  const expandedWidths = await sampleWidths();
  expect(new Set(expandedWidths.map((sample) => sample.join(':'))).size).toBe(1);
  expect(expandedWidths[0]).toEqual([380, 380, 380, 380]);

  await page.locator('#allowlist-track-input').fill('TrackVideo1');
  await page.locator('#allowlist-track-input').press('Enter');
  await expect(page.locator('.user-rule-manager code')).toContainText(
    'TrackVideo1',
  );
  await page.locator('#noai-enabled').uncheck();
  const updatedWidths = await sampleWidths();
  expect(new Set(updatedWidths.map((sample) => sample.join(':'))).size).toBe(1);
  expect(updatedWidths[0]).toEqual([380, 380, 380, 380]);

  await page
    .getByRole('button', { name: /(?:Remove|삭제): TrackVideo1/ })
    .click();
  const removedWidths = await sampleWidths();
  expect(new Set(removedWidths.map((sample) => sample.join(':'))).size).toBe(1);
  expect(removedWidths[0]).toEqual([380, 380, 380, 380]);

  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect(page.locator('.settings-panel--compact')).toHaveCSS(
    'overflow-y',
    'auto',
  );
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test('popup and options entrypoints load', async ({ page, extensionId }) => {
  await page.setViewportSize({ height: 600, width: 380 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('heading', { name: 'NoAI' })).toBeVisible();
  await expect(page.locator('.settings-panel__status')).toContainText(
    /On|켜짐/,
  );
  await expect(page.locator('#noai-enabled')).toBeChecked();
  await expect(page.locator('#noai-youtube-music-auto-skip')).toBeChecked();
  await expect(page.locator('input[type="radio"][value="hide"]')).toBeChecked();
  await expect(page.locator('.mode-option')).toHaveCount(3);
  await expect(page.locator('.mode-option').nth(0)).toContainText(
    /Remove matching content|대상 콘텐츠를 목록에서 숨깁니다/,
  );
  await expect(page.locator('.mode-option').nth(1)).toContainText(
    /Keep content visible but blurred|콘텐츠는 남기고 내용을 흐립니다/,
  );
  await expect(page.locator('.mode-option').nth(2)).toContainText(
    /Keep content and show the reason|콘텐츠는 그대로 두고 이유만 표시합니다/,
  );
  await expect(
    page.getByRole('heading', { name: /User rules|사용자 규칙/ }),
  ).toBeVisible();
  await expect(page.locator('.settings-panel__priority-note')).toContainText(
    /Allowlist rules take priority|허용 목록이 차단 목록보다 우선합니다/,
  );

  const enabled = page.locator('#noai-enabled');
  const mainToggle = page.locator(
    '.settings-panel__section--primary .switch-control',
  );
  await mainToggle.click();
  await expect(enabled).not.toBeChecked();
  await expect(page.locator('.settings-panel__status')).toContainText(
    /Off|꺼짐/,
  );
  for (const mode of ['hide', 'blur', 'mark']) {
    await expect(page.locator(`input[name="filter-mode"][value="${mode}"]`)).toBeDisabled();
  }
  await expect(page.locator('#noai-youtube-music-auto-skip')).toBeDisabled();
  await expect(
    page.locator('.user-rule-manager__disclosure').first(),
  ).toBeEnabled();
  await mainToggle.click();
  await expect(enabled).toBeChecked();

  await page.locator('input[type="radio"][value="mark"]').check();
  await expect(page.locator('input[type="radio"][value="mark"]')).toBeChecked();
  await page.locator('#noai-youtube-music-auto-skip').uncheck();
  await expect(page.locator('#noai-youtube-music-auto-skip')).not.toBeChecked();

  const popupOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(popupOverflow.scrollWidth).toBeLessThanOrEqual(
    popupOverflow.clientWidth,
  );

  await page.setViewportSize({ height: 800, width: 900 });
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'NoAI' })).toBeVisible();
  await expect(page.locator('input[type="radio"][value="mark"]')).toBeChecked();
  await expect(page.locator('#noai-youtube-music-auto-skip')).not.toBeChecked();
  await expect(page.locator('body')).toHaveClass(/noai-options/);
  await expect(page.locator('.settings-panel--full')).toBeVisible();
  await expect(page.locator('.user-rule-manager__disclosure')).toHaveCount(0);
  await expect(page.locator('#allowlist-track-input')).toBeVisible();
  await expect(page.locator('#blocklist-channel-input')).toBeVisible();
});

test('popup manages the allowlist without opening another page', async ({
  context,
  extensionId,
  page,
}) => {
  await page.setViewportSize({ height: 600, width: 380 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  const initialPageCount = context.pages().length;
  const disclosure = page.locator(
    '.user-rule-manager:not(.blocklist-manager) .user-rule-manager__disclosure',
  );
  const summary = disclosure.locator('> summary');

  await expect(summary).toContainText(/0 saved|0개 저장됨/);
  await expect(summary).toContainText(
    /Never filter or skip|필터링과 건너뛰기에서 제외합니다/,
  );
  const closedChevronTransform = await summary
    .locator('.user-rule-manager__chevron')
    .evaluate((element) => getComputedStyle(element).transform);
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect
    .poll(() =>
      summary
        .locator('.user-rule-manager__chevron')
        .evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(closedChevronTransform);
  await page.keyboard.press(' ');
  await expect(disclosure).not.toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');

  const trackInput = page.locator('#allowlist-track-input');
  await trackInput.fill('track title');
  await trackInput.press('Enter');
  await expect(trackInput).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#allowlist-track-error')).toBeVisible();

  await trackInput.fill('TrackVideo1');
  await trackInput.press('Enter');
  await expect(summary).toContainText(/1 saved|1개 저장됨/);
  await page
    .getByRole('button', { name: /(?:Remove|삭제): TrackVideo1/ })
    .click();
  await expect(summary).toContainText(/0 saved|0개 저장됨/);

  const artistId = 'UCabcdefghijklmnopqrstuv';
  const artistInput = page.locator('#allowlist-artist-input');
  await artistInput.fill(artistId);
  await artistInput.press('Enter');
  await expect(summary).toContainText(/1 saved|1개 저장됨/);
  await page
    .getByRole('button', { name: new RegExp(`(?:Remove|삭제): ${artistId}`) })
    .click();
  await expect(summary).toContainText(/0 saved|0개 저장됨/);

  expect(context.pages()).toHaveLength(initialPageCount);
  await expect(page).toHaveURL(`chrome-extension://${extensionId}/popup.html`);
});

test('popup manages track, artist, and channel direct block rules', async ({ page, extensionId }) => {
  await page.setViewportSize({ height: 600, width: 380 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  const disclosure = page.locator(
    '.blocklist-manager .user-rule-manager__disclosure',
  );
  const summary = disclosure.locator('> summary');
  await expect(summary).toContainText(/0 saved|0개 저장됨/);
  await expect(summary).toContainText(
    /Filter or skip items|직접 지정한 항목을 필터링합니다/,
  );
  await expect(summary.locator('.user-rule-manager__chevron')).toBeVisible();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');

  await page.locator('#blocklist-track-input').fill('TrackVideo1');
  await page.locator('form:has(#blocklist-track-input) button').click();
  await expect(summary).toContainText(/1 saved|1개 저장됨/);
  await page.locator('#blocklist-track-input').fill('TrackVideo1');
  await page.locator('form:has(#blocklist-track-input) button').click();
  await expect(summary).toContainText(/1 saved|1개 저장됨/);
  const channel = 'UCabcdefghijklmnopqrstuv';
  await page.locator('#blocklist-artist-input').fill(channel);
  await page.locator('form:has(#blocklist-artist-input) button').click();
  await page.locator('#blocklist-channel-input').fill('https://www.youtube.com/%40%EB%B8%94%EB%A3%A8%EB%A0%88%EC%9D%B8');
  await page.locator('form:has(#blocklist-channel-input) button').click();
  await expect(summary).toContainText(/3 saved|3개 저장됨/);
  await expect(page.locator('.blocklist-manager code', { hasText: '@블루레인' })).toHaveCount(1);
  await expect(page.locator('.settings-panel--compact')).toHaveCSS(
    'overflow-y',
    'auto',
  );

  const longHandle = '@abcdefghijklmnopqrstuvwxyz1234';
  await page.locator('#blocklist-channel-input').fill(longHandle);
  await page.locator('form:has(#blocklist-channel-input) button').click();
  await expect(page.locator('.blocklist-manager code', { hasText: longHandle })).toHaveCount(1);
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.body.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  expect(overflow.scrollHeight).toBeGreaterThan(0);

  await page.locator('#blocklist-track-input').fill('not-an-id');
  await page.locator('form:has(#blocklist-track-input) button').click();
  await expect(page.locator('#blocklist-track-input')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#blocklist-track-input')).toHaveAttribute(
    'aria-describedby',
    'blocklist-track-input-error',
  );
  await page.getByRole('button', { name: /(?:Remove|삭제): TrackVideo1/ }).click();
  await expect(summary).toContainText(/3 saved|3개 저장됨/);

  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press(' ');
  await expect(disclosure).not.toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');

  const scrollMetrics = await page
    .locator('.settings-panel--compact')
    .evaluate((panel) => ({
      clientHeight: panel.clientHeight,
      scrollHeight: panel.scrollHeight,
    }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
});
