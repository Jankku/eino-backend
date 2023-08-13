import axios from 'axios';
import { z } from 'zod';
import config from '../../config';
import { cachified } from 'cachified';
import { cache, cacheSchema, getCacheKey } from '../../util/cache';

const tmdbSearchSchema = z.object({
  results: z.array(z.object({ poster_path: z.string().nullish() })),
});

export const fetchTmdbImages = async (query: string): Promise<string[]> => {
  if (!config.TMDB_API_KEY) return [];

  return cachified({
    cache: cache,
    key: getCacheKey('tmdb', query),
    checkValue: cacheSchema,
    async getFreshValue(context) {
      const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
        params: {
          query,
          api_key: config.TMDB_API_KEY,
        },
      });
      const validated = tmdbSearchSchema.safeParse(response.data);
      if (!validated.success) {
        context.metadata.ttl = -1;
        return [];
      }

      return validated.data.results
        .filter(({ poster_path }) => poster_path)
        .map(({ poster_path }) => `https://image.tmdb.org/t/p/w342${poster_path}`);
    },
  });
};
