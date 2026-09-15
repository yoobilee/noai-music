import type { BrowserContext } from '@playwright/test';

export async function setBlocklist(context: BrowserContext, value: { tracks?: Array<{ videoId: string }>; artists?: Array<{ artistId: string }>; channels?: Array<{ identityType: 'channel-id'; channelId: string } | { identityType: 'handle'; handle: string }> }): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async (blocklist) => {
    const scope = globalThis as typeof globalThis & { chrome: { storage: { local: { set(items: Record<string, unknown>): Promise<void> } } } };
    await scope.chrome.storage.local.set({ blocklistV1: { schemaVersion: 1, tracks: blocklist.tracks ?? [], artists: blocklist.artists ?? [], channels: blocklist.channels ?? [] } });
  }, value);
}
