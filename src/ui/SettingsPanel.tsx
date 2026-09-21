import { useEffect, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';

import type { FilterMode } from '@/filtering/contracts';
import {
  DEFAULT_SETTINGS,
  type PersistedSettings,
  type UiLocalePreference,
} from '@/storage/contracts';
import {
  loadSettings,
  readSettingsChange,
  saveSettings,
} from '@/storage/settings';
import { AllowlistManager } from '@/ui/AllowlistManager';
import { BlocklistManager } from '@/ui/BlocklistManager';
import { I18nProvider, useMessage } from '@/ui/I18nContext';

type MessageKey =
  | 'brandName'
  | 'enabledDescription'
  | 'enabledLabel'
  | 'filterModeBlur'
  | 'filterModeBlurDescription'
  | 'filterModeHide'
  | 'filterModeHideDescription'
  | 'filterModeLabel'
  | 'filterModeMark'
  | 'filterModeMarkDescription'
  | 'filterScopeDescription'
  | 'filterStateDisabled'
  | 'filterStateEnabled'
  | 'languageAuto'
  | 'languageEnglish'
  | 'languageKorean'
  | 'languageLabel'
  | 'settingsSaveError'
  | 'userRulesDescription'
  | 'userRulesHeading'
  | 'userRulesPriorityNote'
  | 'youtubeMusicAutoSkipDescription'
  | 'youtubeMusicAutoSkipLabel'
  | 'youtubeMusicHeading';

const MODE_MESSAGE_KEYS = {
  hide: {
    description: 'filterModeHideDescription',
    label: 'filterModeHide',
  },
  blur: {
    description: 'filterModeBlurDescription',
    label: 'filterModeBlur',
  },
  mark: {
    description: 'filterModeMarkDescription',
    label: 'filterModeMark',
  },
} as const satisfies Record<
  FilterMode,
  { description: MessageKey; label: MessageKey }
>;

interface SettingsPanelProps {
  userListsVariant?: 'compact' | 'full';
}

export function SettingsPanel({ userListsVariant }: SettingsPanelProps) {
  const [settings, setSettings] = useState<PersistedSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let active = true;
    void loadSettings(browser.storage.local)
      .then((loaded) => {
        if (active) {
          setSettings(loaded);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    const handleStorageChange = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      const changedSettings = readSettingsChange(changes, areaName);
      if (changedSettings !== null) {
        setSettings(changedSettings);
        setStatus('ready');
      }
    };
    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      active = false;
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const updateSettings = (next: PersistedSettings) => {
    setSettings(next);
    setStatus('saving');
    void saveSettings(browser.storage.local, next)
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'));
  };

  return (
    <I18nProvider preference={settings.uiLocale}>
      <SettingsPanelContent
        settings={settings}
        status={status}
        updateSettings={updateSettings}
        userListsVariant={userListsVariant}
      />
    </I18nProvider>
  );
}

interface SettingsPanelContentProps extends SettingsPanelProps {
  settings: PersistedSettings;
  status: 'loading' | 'ready' | 'saving' | 'error';
  updateSettings(next: PersistedSettings): void;
}

function SettingsPanelContent({
  settings,
  status,
  updateSettings,
  userListsVariant,
}: SettingsPanelContentProps) {
  const resolveMessage = useMessage();
  const message = (key: MessageKey) => resolveMessage(key);

  const savingDisabled = status === 'loading' || status === 'saving';
  const localeDisabled = status === 'loading';
  const secondaryDisabled = savingDisabled || !settings.enabled;
  const compact = userListsVariant === 'compact';

  return (
    <main
      className={`settings-panel settings-panel--${compact ? 'compact' : 'full'}`}
    >
      <header className="settings-panel__header">
        <div>
          <h1>{message('brandName')}</h1>
          <p>{message('filterScopeDescription')}</p>
        </div>
        <span
          aria-live="polite"
          className="settings-panel__status"
          data-enabled={settings.enabled}
        >
          {message(
            settings.enabled ? 'filterStateEnabled' : 'filterStateDisabled',
          )}
        </span>
      </header>

      <div className="settings-panel__configuration">
        <section
          aria-label={message('enabledLabel')}
          className="settings-panel__section settings-panel__section--primary"
        >
          <label className="switch-control" htmlFor="noai-enabled">
            <span className="switch-control__copy">
              <strong>{message('enabledLabel')}</strong>
              <span>{message('enabledDescription')}</span>
            </span>
            <input
              checked={settings.enabled}
              disabled={savingDisabled}
              id="noai-enabled"
              onChange={(event) =>
                updateSettings({
                  ...settings,
                  enabled: event.currentTarget.checked,
                })
              }
              type="checkbox"
            />
            <span aria-hidden="true" className="switch-control__visual" />
          </label>
        </section>

        <fieldset
          className="settings-panel__section settings-panel__mode-section"
          data-disabled={secondaryDisabled}
          disabled={secondaryDisabled}
        >
          <legend>{message('filterModeLabel')}</legend>
          <div className="settings-panel__modes">
            {(['hide', 'blur', 'mark'] satisfies readonly FilterMode[]).map(
              (mode) => (
                <label className="mode-option" key={mode}>
                  <input
                    checked={settings.mode === mode}
                    name="filter-mode"
                    onChange={() => updateSettings({ ...settings, mode })}
                    type="radio"
                    value={mode}
                  />
                  <span className="mode-option__surface">
                    <span
                      aria-hidden="true"
                      className="mode-option__indicator"
                    />
                    <span className="mode-option__copy">
                      <strong>{message(MODE_MESSAGE_KEYS[mode].label)}</strong>
                      <span>
                        {message(MODE_MESSAGE_KEYS[mode].description)}
                      </span>
                    </span>
                  </span>
                </label>
              ),
            )}
          </div>
        </fieldset>

        <section
          aria-labelledby="youtube-music-heading"
          className="settings-panel__section settings-panel__music-section"
          data-disabled={secondaryDisabled}
        >
          <header className="settings-panel__section-header">
            <h2 id="youtube-music-heading">{message('youtubeMusicHeading')}</h2>
            <p>{message('youtubeMusicAutoSkipDescription')}</p>
          </header>
          <label
            className="switch-control switch-control--compact"
            htmlFor="noai-youtube-music-auto-skip"
          >
            <span className="switch-control__copy">
              <strong>{message('youtubeMusicAutoSkipLabel')}</strong>
            </span>
            <input
              checked={settings.youtubeMusicAutoSkip}
              disabled={secondaryDisabled}
              id="noai-youtube-music-auto-skip"
              onChange={(event) =>
                updateSettings({
                  ...settings,
                  youtubeMusicAutoSkip: event.currentTarget.checked,
                })
              }
              type="checkbox"
            />
            <span aria-hidden="true" className="switch-control__visual" />
          </label>
        </section>

        <section className="settings-panel__section settings-panel__locale-section">
          <label htmlFor="noai-ui-locale">
            <strong>{message('languageLabel')}</strong>
          </label>
          <select
            disabled={localeDisabled}
            id="noai-ui-locale"
            onChange={(event) =>
              updateSettings({
                ...settings,
                uiLocale: event.currentTarget.value as UiLocalePreference,
              })
            }
            value={settings.uiLocale}
          >
            <option value="auto">{message('languageAuto')}</option>
            <option value="ko">{message('languageKorean')}</option>
            <option value="en">{message('languageEnglish')}</option>
          </select>
        </section>

        {status === 'error' ? (
          <p className="settings-panel__error" role="alert">
            {message('settingsSaveError')}
          </p>
        ) : null}
      </div>

      {userListsVariant === undefined ? null : (
        <section
          aria-labelledby="user-rules-heading"
          className="settings-panel__user-rules"
        >
          <header className="settings-panel__section-header">
            <h2 id="user-rules-heading">{message('userRulesHeading')}</h2>
            <p>{message('userRulesDescription')}</p>
          </header>
          <p className="settings-panel__priority-note">
            {message('userRulesPriorityNote')}
          </p>
          <div className="settings-panel__rule-sections">
            <AllowlistManager compact={compact} />
            <BlocklistManager compact={compact} />
          </div>
        </section>
      )}
    </main>
  );
}
