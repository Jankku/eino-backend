import { MessagePort, workerData } from 'node:worker_threads';
import { renderShareImage, type ShareImageInput } from './shareimage.ts';

export type ShareImageResult = { image: Uint8Array } | { error: unknown };

const data: unknown = workerData;
if (!data || typeof data !== 'object' || !('port' in data) || !(data.port instanceof MessagePort)) {
  throw new Error('Share image worker requires a message port');
}
const { port } = data;
port.on('message', async (input: ShareImageInput) => {
  let result: ShareImageResult;
  try {
    result = { image: await renderShareImage(input) };
  } catch (error) {
    result = { error };
  }
  port.postMessage(result);
});
