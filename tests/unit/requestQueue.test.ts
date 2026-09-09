import { describe, expect, it } from 'vitest';

import {
  createRequestQueue,
  RequestQueueFullError,
} from '@/background/requestQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('watch-page request queue', () => {
  it('limits active requests and starts queued work as slots open', async () => {
    const queue = createRequestQueue(2, 3);
    const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
    let active = 0;
    let peakActive = 0;
    const runs = gates.map((gate) =>
      queue.run(async () => {
        active += 1;
        peakActive = Math.max(peakActive, active);
        await gate.promise;
        active -= 1;
      }),
    );

    await Promise.resolve();
    expect(active).toBe(2);
    gates[0]!.resolve();
    await runs[0];
    await Promise.resolve();
    expect(active).toBe(2);
    gates[1]!.resolve();
    gates[2]!.resolve();
    await Promise.all(runs);
    expect(peakActive).toBe(2);
  });

  it('fails closed when the bounded queue is full', async () => {
    const queue = createRequestQueue(1, 1);
    const first = deferred<void>();
    const firstRun = queue.run(() => first.promise);
    const secondRun = queue.run(async () => undefined);

    await expect(queue.run(async () => undefined)).rejects.toBeInstanceOf(
      RequestQueueFullError,
    );
    first.resolve();
    await Promise.all([firstRun, secondRun]);
  });
});
