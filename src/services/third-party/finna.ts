import { z } from 'zod';
import { cachified } from '@epic-web/cachified';
import { cache, stringArrayCacheSchema, getCacheKey } from '../../util/cache.ts';
import { Logger } from '../../util/logger.ts';
import { fetchJson } from '../../util/http.ts';

const finnaImagesSchema = z
  .object({
    status: z.literal('OK'),
    resultCount: z.int().nonnegative(),
    records: z.array(z.object({ images: z.array(z.string()) })).optional(),
  })
  .refine((data) => data.resultCount === 0 || data.records !== undefined, {
    path: ['records'],
    message: 'Expected records when resultCount is greater than zero',
  });

export type FinnaFilter = 'book' | 'video';

export const fetchFinnaImages = async (
  query: string,
  finnaFilter: FinnaFilter,
): Promise<string[]> => {
  const isBookFilter = finnaFilter === 'book';
  return cachified({
    cache: cache,
    key: getCacheKey(isBookFilter ? 'finna-book' : 'finna-video', query),
    checkValue: stringArrayCacheSchema,
    async getFreshValue(context) {
      const url = new URL('https://api.finna.fi/api/v1/search');
      url.search = new URLSearchParams({
        lookfor: query,
        'field[]': 'images',
        'filter[]': isBookFilter ? 'format:0/Book/' : 'format:1/Video/Feature/',
        limit: '20',
      }).toString();
      const response = await fetchJson(url);
      const validated = finnaImagesSchema.safeParse(response);
      if (!validated.success) {
        context.metadata.ttl = -1;
        Logger.error('Invalid Finna image data', {
          query,
          filter: finnaFilter,
          issues: validated.error.issues,
        });
        return [];
      }

      return (validated.data.records ?? [])
        .filter((result) => result.images.length > 0)
        .map((result) => result.images)
        .flatMap((images) => new URL(images[0], 'https://finna.fi/').href);
    },
  });
};
