import { LRUCache } from 'lru-cache';
import { CacheEntry, lruCacheAdapter } from 'cachified';
import { z } from 'zod';

const lru = new LRUCache<string, CacheEntry>({ max: 500 });

export const cache = lruCacheAdapter(lru);

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
