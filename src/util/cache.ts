import { LRUCache } from 'lru-cache';
import { CacheEntry, Cache, totalTtl } from '@epic-web/cachified';
import { z } from 'zod';

const lru = new LRUCache<string, CacheEntry>({ max: 500 });

export const cache: Cache = {
  set(key, value) {
    const ttl = totalTtl(value?.metadata);
    return lru.set(key, value, {
      ttl: ttl === Number.POSITIVE_INFINITY ? undefined : ttl,
      start: value?.metadata?.createdTime,
    });
  },
  get(key) {
    return lru.get(key);
  },
  delete(key) {
    return lru.delete(key);
  },
};

export const cacheSchema = z.array(z.string());

type ThirdPartyService = 'finna-book' | 'finna-video' | 'tmdb' | 'openlibrary';

export const getCacheKey = (service: ThirdPartyService, query: string) => {
  const normalizedQuery = query
    .trim()
    .toLowerCase()
    .normalize()
    .replaceAll(/\s+/g, ' ')
    .split(' ')
    .join('-');
  return `${service}-${normalizedQuery}`;
};
