import axios from 'axios';
import { z } from 'zod';

const openLibraryImageSchema = z.object({
  numFound: z.number(),
  docs: z.array(z.object({ cover_i: z.number().optional() })),
});

export const fetchOpenLibraryImages = async (query: string): Promise<string[]> => {
  const response = await axios.get('https://openlibrary.org/search.json', {
    params: {
      q: query,
      limit: 40,
      fields: ['cover_i'],
    },
  });
  const { docs } = openLibraryImageSchema.parse(response.data);

  return docs
    .filter((item) => item.cover_i !== undefined)
    .map(({ cover_i }) => `https://covers.openlibrary.org/b/id/${cover_i}-M.jpg`);
};
