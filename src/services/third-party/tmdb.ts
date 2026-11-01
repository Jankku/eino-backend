import { z } from 'zod';
import { config } from '../../config';
import { cachified } from '@epic-web/cachified';
import { cache, stringArrayCacheSchema, getCacheKey } from '../../util/cache';
import { Logger } from '../../util/logger';
import { fetchJson } from '../../util/http';

const tmdbSearchSchema = z.object({
  results: z.array(z.object({ poster_path: z.string().nullish() })),
});

export const fetchTmdbImages = async (query: string): Promise<string[]> => {
  const apiKey = config.TMDB_API_KEY;
  if (!apiKey) return [];

  return cachified({
    cache: cache,
    key: getCacheKey('tmdb', query),
    checkValue: stringArrayCacheSchema,
    async getFreshValue(context) {
      const url = new URL('https://api.themoviedb.org/3/search/movie');
      url.search = new URLSearchParams({
        query,
        api_key: apiKey,
      }).toString();
      const response = await fetchJson(url);
      const validated = tmdbSearchSchema.safeParse(response);
      if (!validated.success) {
        context.metadata.ttl = -1;
        Logger.error('Invalid TMDB image data', {
          query,
          issues: validated.error.issues,
        });
        return [];
      }

      return validated.data.results
        .filter(({ poster_path }) => poster_path)
        .map(({ poster_path }) => `https://image.tmdb.org/t/p/w342${poster_path}`);
    },
  });
};
