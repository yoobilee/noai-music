import type { UiLocalePreference } from '@/storage/contracts';

export type SupportedUiLocale = Exclude<UiLocalePreference, 'auto'>;

interface ChromeMessagePlaceholder {
  content: string;
}

interface ChromeMessageEntry {
  message: string;
  placeholders?: Record<string, ChromeMessagePlaceholder>;
}

export type MessageCatalog = Record<string, ChromeMessageEntry>;
export type MessageSubstitutions = string | string[] | undefined;
export type MessageResolver = (
  key: string,
  substitutions?: MessageSubstitutions,
) => string;

const catalogCache = new Map<SupportedUiLocale, Promise<MessageCatalog>>();

function substitutionsArray(
  substitutions: MessageSubstitutions,
): readonly string[] {
  if (substitutions === undefined) return [];
  return Array.isArray(substitutions) ? substitutions : [substitutions];
}

function replacePositionalTokens(
  value: string,
  substitutions: readonly string[],
): string {
  return value.replace(/\$(\d+)/g, (_match, index: string) => {
    const substitution = substitutions[Number(index) - 1];
    return substitution ?? '';
  });
}

export function formatCatalogMessage(
  catalog: MessageCatalog,
  key: string,
  substitutions?: MessageSubstitutions,
): string {
  const entry = catalog[key];
  if (entry === undefined) return '';

  const values = substitutionsArray(substitutions);
  let result = entry.message;
  for (const [name, placeholder] of Object.entries(
    entry.placeholders ?? {},
  )) {
    result = result.replace(
      new RegExp(`\\$${name}\\$`, 'gi'),
      replacePositionalTokens(placeholder.content, values),
    );
  }

  return replacePositionalTokens(result, values).replace(/\$\$/g, '$');
}

export function createMessageResolver(
  preference: UiLocalePreference,
  catalog: MessageCatalog | null,
  autoMessage: MessageResolver,
): MessageResolver {
  if (preference === 'auto' || catalog === null) return autoMessage;

  return (key, substitutions) =>
    formatCatalogMessage(catalog, key, substitutions) ||
    autoMessage(key, substitutions);
}

export function effectiveUiLocale(
  preference: UiLocalePreference,
  browserLocale: string,
): string {
  return preference === 'auto' ? browserLocale : preference;
}

export function loadLocaleCatalog(
  locale: SupportedUiLocale,
  resourceUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<MessageCatalog> {
  const cached = catalogCache.get(locale);
  if (cached !== undefined) return cached;

  const loading = fetcher(resourceUrl).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Could not load ${locale} UI messages.`);
    }
    return (await response.json()) as MessageCatalog;
  });
  catalogCache.set(locale, loading);
  void loading.catch(() => catalogCache.delete(locale));
  return loading;
}
