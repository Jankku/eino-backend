import axios from 'axios';
import { z } from 'zod';
import { cachified } from '@epic-web/cachified';
import { cache, cacheSchema, getCacheKey } from '../../util/cache';

const openLibraryImageSchema = z.object({
  numFound: z.number(),
  docs: z.array(z.object({ cover_i: z.number().optional() })),
});

export const fetchOpenLibraryImages = async (query: string): Promise<string[]> => {
  return cachified({
    cache: cache,
    key: getCacheKey('openlibrary', query),
    checkValue: cacheSchema,
    async getFreshValue(context) {
      const response = await axios.get('https://openlibrary.org/search.json', {
        params: {
          q: query,
          limit: 40,
          fields: ['cover_i'],
        },
      });
      const validated = openLibraryImageSchema.safeParse(response.data);
      if (!validated.success) {
        context.metadata.ttl = -1;
        return [];
      }

      return validated.data.docs
        .filter((item) => item.cover_i !== undefined)
        .map(({ cover_i }) => `https://covers.openlibrary.org/b/id/${cover_i}-M.jpg`);
    },
  });
};
