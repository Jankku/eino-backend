import { MessageChannel, type MessagePort, Worker } from 'node:worker_threads';
import type { ShareImageInput } from './shareimage.ts';
import type { ShareImageResult } from './shareimageworker.ts';

type RenderTask = {
  input: ShareImageInput;
  promise: Promise<Buffer>;
  resolve: (image: Buffer) => void;
  reject: (error: unknown) => void;
};

const queue: RenderTask[] = [];
let active: RenderTask | undefined;
let worker: Worker | undefined;
let port: MessagePort | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let closing = false;

const rejectPending = (error: unknown) => {
  active?.reject(error);
  active = undefined;
  for (const task of queue.splice(0)) task.reject(error);
};

const releaseWorker = () => {
  clearTimeout(idleTimer);
  const current = worker;
  worker = undefined;
  port?.close();
  port = undefined;
  return current?.terminate();
};

const startWorker = () => {
  const { port1, port2 } = new MessageChannel();
  let current: Worker;
  try {
    current = new Worker(
      new URL(
        import.meta.url.endsWith('.ts') ? './shareimageworker.ts' : './shareimageworker.js',
        import.meta.url,
      ),
      { workerData: { port: port2 }, transferList: [port2] },
    );
  } catch (error) {
    port1.close();
    port2.close();
    throw error;
  }
  worker = current;
  port = port1;
  // Render results use a dedicated port, separate from Node's watch-mode messages.
  port1.on('message', (result: ShareImageResult) => {
    if (worker !== current || !active) return;
    const task = active;
    active = undefined;
    if ('error' in result) task.reject(result.error);
    else task.resolve(Buffer.from(result.image));
    runNext();
  });
  current.once('error', (error) => {
    if (worker !== current) return;
    rejectPending(error);
    void releaseWorker();
  });
  current.once('exit', (code) => {
    if (worker !== current) return;
    rejectPending(new Error(`Share image worker exited unexpectedly (${code})`));
    void releaseWorker();
  });
};

const runNext = () => {
  clearTimeout(idleTimer);
  active = queue.shift();
  if (!active) {
    worker?.unref();
    port?.unref();
    idleTimer = setTimeout(() => void releaseWorker(), 60_000);
    idleTimer.unref();
    return;
  }
  try {
    if (!worker) startWorker();
    worker!.ref();
    port!.ref();
    port!.postMessage(active.input);
  } catch (error) {
    rejectPending(error);
    void releaseWorker();
  }
};

export const renderShareImage = (input: ShareImageInput): Promise<Buffer> => {
  if (closing) return Promise.reject(new Error('Share image worker is closed'));
  if (queue.length >= 8) return Promise.reject(new Error('Share image queue is full'));
  const { promise, resolve, reject } = Promise.withResolvers<Buffer>();
  queue.push({ input, promise, resolve, reject });
  if (!active) runNext();
  return promise;
};

export const closeShareImagePool = async (): Promise<void> => {
  closing = true;
  const error = new Error('Share image worker is closed');
  for (const task of queue.splice(0)) task.reject(error);
  // Let native canvas calls finish before terminating their worker.
  await active?.promise.catch(() => {});
  await releaseWorker();
};
