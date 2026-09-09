import { useEffect, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';

import type { FilterMode } from '@/filtering/contracts';
import { DEFAULT_SETTINGS, type PersistedSettings } from '@/storage/contracts';
import {
  loadSettings,
  readSettingsChange,
  saveSettings,
} from '@/storage/settings';

type MessageKey =
  | 'extName'
  | 'enabledLabel'
  | 'filterModeLabel'
  | 'filterModeHide'
  | 'filterModeBlur'
  | 'filterModeMark'
  | 'filterScopeDescription'
  | 'filterStateEnabled'
  | 'filterStateDisabled'
  | 'settingsSaveError';

const MODE_MESSAGE_KEYS = {
  hide: 'filterModeHide',
  blur: 'filterModeBlur',
  mark: 'filterModeMark',
} as const satisfies Record<FilterMode, MessageKey>;

function message(key: MessageKey): string {
  return browser.i18n.getMessage(key);
}

export function SettingsPanel() {
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
        if (active) {
          setStatus('error');
        }
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

  const disabled = status === 'loading' || status === 'saving';

  return (
    <main className="settings-panel">
      <h1>{message('extName')}</h1>
      <p className="settings-panel__description">
        {message('filterScopeDescription')}
      </p>

      <label className="settings-panel__toggle" htmlFor="noai-enabled">
        <span>{message('enabledLabel')}</span>
        <input
          checked={settings.enabled}
          disabled={disabled}
          id="noai-enabled"
          onChange={(event) =>
            updateSettings({ ...settings, enabled: event.currentTarget.checked })
          }
          type="checkbox"
        />
      </label>

      <fieldset disabled={disabled}>
        <legend>{message('filterModeLabel')}</legend>
        {(['hide', 'blur', 'mark'] satisfies readonly FilterMode[]).map(
          (mode) => (
            <label className="settings-panel__mode" key={mode}>
              <input
                checked={settings.mode === mode}
                name="filter-mode"
                onChange={() => updateSettings({ ...settings, mode })}
                type="radio"
                value={mode}
              />
              <span>
                {message(MODE_MESSAGE_KEYS[mode])}
              </span>
            </label>
          ),
        )}
      </fieldset>

      <p className="settings-panel__state">
        {message(settings.enabled ? 'filterStateEnabled' : 'filterStateDisabled')}
      </p>
      {status === 'error' ? (
        <p className="settings-panel__error" role="alert">
          {message('settingsSaveError')}
        </p>
      ) : null}
    </main>
  );
}
