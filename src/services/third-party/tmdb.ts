import axios from 'axios';
import { z } from 'zod';

const tmdbSearchSchema = z.object({
  results: z.array(z.object({ poster_path: z.string().nullish() })),
});

export const fetchTmdbImages = async (query: string): Promise<string[]> => {
  const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
    params: {
      query,
      api_key: process.env.TMDB_API_KEY,
    },
  });
  const { results } = tmdbSearchSchema.parse(response.data);

  return results
    .filter(({ poster_path }) => poster_path)
    .map(({ poster_path }) => `https://image.tmdb.org/t/p/w342${poster_path}`);
};
