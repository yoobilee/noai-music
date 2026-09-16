// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  observeYouTubeMusicQueueIdentities,
  syncYouTubeMusicQueueIdentities,
  YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE,
} from '@/adapters/youtube-music/queueIdentityBridge';

async function flushMutations(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('YouTube Music queue identity bridge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mirrors only an exact live data.videoId onto shared DOM', () => {
    const item = document.createElement('ytmusic-player-queue-item');
    Object.assign(item, { data: { videoId: 'QueueAI0001' } });
    document.body.append(item);

    syncYouTubeMusicQueueIdentities(document);

    expect(item.getAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE)).toBe(
      'QueueAI0001',
    );
  });

  it.each([
    undefined,
    'invalid',
    ['QueueAI0001', 'QueueOrd001'],
  ])('removes stale shared identity for invalid data: %o', (videoId) => {
    const item = document.createElement('ytmusic-player-queue-item');
    item.setAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE, 'StaleQueue1');
    Object.assign(item, { data: { videoId } });
    document.body.append(item);

    syncYouTubeMusicQueueIdentities(item);

    expect(item.hasAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE)).toBe(
      false,
    );
  });

  it('updates a reused item after its rendered children mutate', async () => {
    const item = document.createElement('ytmusic-player-queue-item');
    Object.assign(item, { data: { videoId: 'QueueAI0001' } });
    document.body.append(item);
    const stop = observeYouTubeMusicQueueIdentities(document);
    expect(item.getAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE)).toBe(
      'QueueAI0001',
    );

    Object.assign(item, { data: { videoId: 'QueueOrd001' } });
    item.append(document.createElement('span'));
    await flushMutations();

    expect(item.getAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE)).toBe(
      'QueueOrd001',
    );
    stop();
  });

  it('fails closed when page data access throws', () => {
    const item = document.createElement('ytmusic-player-queue-item');
    item.setAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE, 'StaleQueue1');
    Object.defineProperty(item, 'data', {
      get() {
        throw new Error('synthetic page getter failure');
      },
    });
    document.body.append(item);

    expect(() => syncYouTubeMusicQueueIdentities(item)).not.toThrow();
    expect(item.hasAttribute(YOUTUBE_MUSIC_QUEUE_VIDEO_ID_ATTRIBUTE)).toBe(
      false,
    );
  });
});
