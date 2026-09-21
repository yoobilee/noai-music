import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { browser } from 'wxt/browser';

import {
  createMessageResolver,
  effectiveUiLocale,
  loadLocaleCatalog,
  type MessageCatalog,
  type MessageResolver,
  type SupportedUiLocale,
} from '@/i18n/messages';
import type { UiLocalePreference } from '@/storage/contracts';

const getBrowserMessage = browser.i18n.getMessage as unknown as MessageResolver;
const autoMessage: MessageResolver = (key, substitutions) =>
  getBrowserMessage(key, substitutions);

const I18nContext = createContext<MessageResolver>(autoMessage);

export function I18nProvider({
  children,
  preference,
}: PropsWithChildren<{ preference: UiLocalePreference }>) {
  const [catalogs, setCatalogs] = useState<
    Partial<Record<SupportedUiLocale, MessageCatalog>>
  >({});

  useEffect(() => {
    let active = true;
    for (const locale of ['en', 'ko'] as const) {
      void loadLocaleCatalog(
        locale,
        browser.runtime.getURL(`/_locales/${locale}/messages.json`),
      )
        .then((catalog) => {
          if (active) {
            setCatalogs((current) => ({ ...current, [locale]: catalog }));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = effectiveUiLocale(
      preference,
      browser.i18n.getUILanguage(),
    );
  }, [preference]);

  const message = useMemo(
    () =>
      createMessageResolver(
        preference,
        preference === 'auto' ? null : (catalogs[preference] ?? null),
        autoMessage,
      ),
    [catalogs, preference],
  );

  return (
    <I18nContext.Provider value={message}>{children}</I18nContext.Provider>
  );
}

export function useMessage(): MessageResolver {
  return useContext(I18nContext);
}
