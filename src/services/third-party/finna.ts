import axios from 'axios';
import { z } from 'zod';
import { cachified } from 'cachified';
import { cache, cacheSchema, getCacheKey } from '../../util/cache';

const finnaImagesSchema = z.object({
  resultCount: z.number(),
  records: z.array(z.object({ images: z.array(z.string()) })),
});

export type FinnaFilter = 'book' | 'video';

export const fetchFinnaImages = async (
  query: string,
  finnaFilter: FinnaFilter
): Promise<string[]> => {
  const isBookFilter = finnaFilter === 'book';
  const filters = isBookFilter ? ['format:0/Book/'] : ['format:1/Video/Feature/'];
  return cachified({
    cache: cache,
    key: getCacheKey(isBookFilter ? 'finna-book' : 'finna-video', query),
    checkValue: cacheSchema,
    async getFreshValue(context) {
      const response = await axios.get('https://api.finna.fi/api/v1/search', {
        params: {
          lookfor: query,
          field: ['images'],
          filter: filters,
          limit: 20,
        },
      });
      const validated = finnaImagesSchema.safeParse(response.data);
      if (!validated.success) {
        context.metadata.ttl = -1;
        return [];
      }

      return validated.data.records
        .filter((result) => result.images.length > 0)
        .map((result) => result.images)
        .flatMap((images) => new URL(images[0], 'https://finna.fi/').toString());
    },
  });
};
