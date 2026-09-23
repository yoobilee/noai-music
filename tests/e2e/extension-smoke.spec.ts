import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test } from './fixtures';
import { setAllowlist } from './allowlistStorage';
import { setBlocklist } from './blocklistStorage';

interface GeneratedManifest {
  manifest_version: number;
  name: string;
  version: string;
  icons?: Record<string, string>;
  action?: {
    default_icon?: Record<string, string>;
    default_popup?: string;
    default_title?: string;
  };
  permissions?: string[];
  host_permissions?: string[];
  options_ui?: {
    page?: string;
    open_in_tab?: boolean;
  };
  content_scripts?: Array<{
    js?: string[];
    matches?: string[];
    world?: 'ISOLATED' | 'MAIN';
  }>;
}

const manifestPath = fileURLToPath(
  new URL('../../.output/chrome-mv3/manifest.json', import.meta.url),
);

async function readBuiltLocale(locale: 'en' | 'ko') {
  return JSON.parse(
    await readFile(
      fileURLToPath(
        new URL(
          `../../.output/chrome-mv3/_locales/${locale}/messages.json`,
          import.meta.url,
        ),
      ),
      'utf8',
    ),
  ) as Record<string, { message: string }>;
}

test('generated manifest stays on MV3 with minimal permissions', async () => {
  const [manifest, english, korean] = await Promise.all([
    readFile(manifestPath, 'utf8').then(
      (value) => JSON.parse(value) as GeneratedManifest,
    ),
    readBuiltLocale('en'),
    readBuiltLocale('ko'),
  ]);

  expect(manifest.manifest_version).toBe(3);
  expect(manifest.version).toBe('1.0.0');
  expect(manifest.name).toBe('__MSG_extName__');
  expect(english.extName?.message).toBe(
    'NoAI — AI-Labeled Music Filter',
  );
  expect(korean.extName?.message).toBe('NoAI — AI 표시 음악 필터');
  expect(english.brandName?.message).toBe('NoAI');
  expect(korean.brandName?.message).toBe('NoAI');
  expect(manifest.icons).toEqual({
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  });
  expect(manifest.action).toEqual({
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
    },
    default_popup: 'popup.html',
    default_title: 'NoAI',
  });
  expect(manifest.permissions).toEqual(['storage']);
  expect(manifest.host_permissions).toEqual(['https://www.youtube.com/*']);
  expect(manifest.host_permissions).not.toContain('<all_urls>');
  expect(manifest.options_ui).toEqual({
    open_in_tab: false,
    page: 'options.html',
  });
  expect(
    [
      ...new Set(
        manifest.content_scripts?.flatMap(
          (contentScript) => contentScript.matches ?? [],
        ),
      ),
    ].sort(),
  ).toEqual([
    'https://music.youtube.com/*',
    'https://www.youtube.com/*',
  ]);
  expect(manifest.content_scripts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        matches: ['https://music.youtube.com/*'],
        world: 'MAIN',
      }),
      expect.objectContaining({
        matches: ['https://music.youtube.com/*'],
        world: 'ISOLATED',
      }),
      expect.objectContaining({
        matches: ['https://www.youtube.com/*'],
        world: 'ISOLATED',
      }),
    ]),
  );
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

test('popup and options share a persisted manual UI language', async ({
  context,
  extensionId,
  page,
}) => {
  await page.setViewportSize({ height: 600, width: 380 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  const popupLocale = page.locator('#noai-ui-locale');
  await expect(popupLocale).toHaveAccessibleName(/Language|언어/);
  await expect(popupLocale).toHaveValue('auto');
  await popupLocale.evaluate((element) => {
    const select = element as HTMLSelectElement;
    select.focus();
    select.value = 'ko';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(popupLocale).toBeFocused();
  await expect(popupLocale).toHaveAccessibleName('언어');
  await expect(page.getByText('필터 사용', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');

  const options = await context.newPage();
  await options.setViewportSize({ height: 800, width: 900 });
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const optionsLocale = options.locator('#noai-ui-locale');
  await expect(optionsLocale).toHaveAccessibleName('언어');
  await expect(optionsLocale).toHaveValue('ko');
  await expect(options.getByText('필터 사용', { exact: true })).toBeVisible();

  await optionsLocale.selectOption('en');
  await expect(optionsLocale).toHaveAccessibleName('Language');
  await expect(options.getByText('Enable filtering', { exact: true })).toBeVisible();
  await expect(options.locator('html')).toHaveAttribute('lang', 'en');
  await expect(popupLocale).toHaveValue('en');
  await expect(popupLocale).toHaveAccessibleName('Language');
  await expect(page.getByText('Enable filtering', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator('#noai-ui-locale')).toHaveValue('en');
  await expect(page.getByText('Enable filtering', { exact: true })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test('options uses a responsive two-column user rule management layout', async ({
  context,
  extensionId,
  page,
}) => {
  await setAllowlist(context, {
    artists: [{ artistId: 'UCabcdefghijklmnopqrstuv' }],
    tracks: [{ videoId: 'TrackVideo1' }],
  });
  await setBlocklist(context, {
    channels: [{ handle: '@example', identityType: 'handle' }],
    tracks: [{ videoId: 'BlockVideo1' }],
  });
  await page.setViewportSize({ height: 900, width: 1100 });
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  const ruleCards = page.locator('.settings-panel__rule-sections > section');
  await expect(ruleCards).toHaveCount(2);
  await expect(
    page.getByRole('heading', { level: 3, name: /Allowlist|허용 목록/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: /Blocklist|차단 목록/ }),
  ).toBeVisible();
  await expect(
    ruleCards.nth(0).locator('.user-rule-manager__summary-count'),
  ).toContainText('2');
  await expect(
    ruleCards.nth(1).locator('.user-rule-manager__summary-count'),
  ).toContainText('2');

  const desktopCards = await ruleCards.evaluateAll((cards) =>
    cards.map((card) => {
      const bounds = card.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top };
    }),
  );
  const desktopAllowlist = desktopCards[0]!;
  const desktopBlocklist = desktopCards[1]!;
  expect(desktopAllowlist.top).toBe(desktopBlocklist.top);
  expect(desktopAllowlist.left).toBeLessThan(desktopBlocklist.left);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await page.setViewportSize({ height: 900, width: 760 });
  const narrowCards = await ruleCards.evaluateAll((cards) =>
    cards.map((card) => {
      const bounds = card.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top };
    }),
  );
  const narrowAllowlist = narrowCards[0]!;
  const narrowBlocklist = narrowCards[1]!;
  expect(narrowAllowlist.left).toBe(narrowBlocklist.left);
  expect(narrowAllowlist.top).toBeLessThan(narrowBlocklist.top);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
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
