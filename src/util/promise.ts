import { Logger } from './logger';

export async function firstNonEmpty<T extends unknown[]>(
  promiseFactories: (() => Promise<T>)[],
): Promise<T> {
  for (const factory of promiseFactories) {
    try {
      const result = await factory();
      if (result && result?.length > 0) return result;
    } catch (error) {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : JSON.stringify(error));
      Logger.error('firstNonEmpty', {
        error: {
          message: normalizedError.message,
          stack: normalizedError.stack,
        },
      });
    }
  }
  return [] as unknown as T;
}
