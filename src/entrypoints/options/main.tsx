import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';

import { SettingsPanel } from '@/ui/SettingsPanel';
import '@/ui/settings.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Options root element was not found.');
}

document.documentElement.lang = browser.i18n.getUILanguage();
document.body.classList.add('noai-options');

createRoot(rootElement).render(
  <StrictMode>
    <SettingsPanel userListsVariant="full" />
  </StrictMode>,
);
