import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';

import { ScaffoldPage } from '@/ui/ScaffoldPage';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Popup root element was not found.');
}

document.documentElement.lang = browser.i18n.getUILanguage();

createRoot(rootElement).render(
  <StrictMode>
    <ScaffoldPage messageKey="popupScaffoldMessage" />
  </StrictMode>,
);
