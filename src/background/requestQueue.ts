export class RequestQueueFullError extends Error {
  constructor() {
    super('The watch-page request queue is full.');
    this.name = 'RequestQueueFullError';
  }
}

export interface RequestQueue {
  run<T>(task: () => Promise<T>): Promise<T>;
}

interface PendingTask<T> {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export function createRequestQueue(
  maxConcurrency: number,
  maxQueued: number,
): RequestQueue {
  if (maxConcurrency < 1 || maxQueued < 0) {
    throw new Error(
      'Request concurrency must be positive and queue capacity non-negative.',
    );
  }

  let activeCount = 0;
  const pending: PendingTask<unknown>[] = [];

  const startNext = () => {
    while (activeCount < maxConcurrency) {
      const next = pending.shift();
      if (next === undefined) {
        return;
      }

      activeCount += 1;
      void next
        .task()
        .then(next.resolve, next.reject)
        .finally(() => {
          activeCount -= 1;
          startNext();
        });
    }
  };

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      if (activeCount >= maxConcurrency && pending.length >= maxQueued) {
        return Promise.reject(new RequestQueueFullError());
      }

      return new Promise<T>((resolve, reject) => {
        pending.push({
          task,
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        startNext();
      });
    },
  };
}
