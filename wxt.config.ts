import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
      },
    },
    permissions: ['storage'],
    host_permissions: ['https://www.youtube.com/*'],
  },
});
