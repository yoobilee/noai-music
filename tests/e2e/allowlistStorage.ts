import type { BrowserContext } from '@playwright/test';

interface E2EAllowlist {
  tracks?: readonly { videoId: string }[];
  artists?: readonly { artistId: string }[];
}

async function getWorker(context: BrowserContext) {
  return (
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  );
}

export async function setAllowlist(
  context: BrowserContext,
  allowlist: E2EAllowlist,
): Promise<void> {
  const worker = await getWorker(context);
  await worker.evaluate(async (next) => {
    const extensionGlobal = globalThis as typeof globalThis & {
      chrome: {
        storage: {
          local: { set(items: Record<string, unknown>): Promise<void> };
        };
      };
    };
    await extensionGlobal.chrome.storage.local.set({
      allowlistV1: {
        schemaVersion: 1,
        tracks: next.tracks ?? [],
        artists: next.artists ?? [],
      },
    });
  }, allowlist);
}

export async function readAllowlist(context: BrowserContext): Promise<unknown> {
  const worker = await getWorker(context);
  return worker.evaluate(async () => {
    const extensionGlobal = globalThis as typeof globalThis & {
      chrome: {
        storage: {
          local: { get(key: string): Promise<Record<string, unknown>> };
        };
      };
    };
    const stored = await extensionGlobal.chrome.storage.local.get('allowlistV1');
    return stored.allowlistV1;
  });
}
