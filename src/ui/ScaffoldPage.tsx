import { browser } from 'wxt/browser';

interface ScaffoldPageProps {
  messageKey: 'popupScaffoldMessage' | 'optionsScaffoldMessage';
}

export function ScaffoldPage({ messageKey }: ScaffoldPageProps) {
  return (
    <main>
      <h1>{browser.i18n.getMessage('extName')}</h1>
      <p>{browser.i18n.getMessage(messageKey)}</p>
    </main>
  );
}
