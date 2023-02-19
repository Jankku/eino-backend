import axios from 'axios';
import { z } from 'zod';

const finnaImagesSchema = z.object({
  resultCount: z.number(),
  records: z.array(z.object({ images: z.array(z.string()) })),
});

type FinnaFilter = 'book' | 'video';

export const fetchFinnaImages = async (
  query: string,
  finnaFilter: FinnaFilter
): Promise<string[]> => {
  const filters = finnaFilter === 'book' ? ['format:0/Book/'] : ['format:1/Video/Feature/'];

  const response = await axios.get('https://api.finna.fi/api/v1/search', {
    params: {
      lookfor: query,
      field: ['images'],
      filter: filters,
      limit: 20,
    },
  });

  const { records } = finnaImagesSchema.parse(response.data);

  return records
    .filter((result) => result.images.length > 0)
    .map((result) => result.images)
    .flatMap((images) => {
      return new URL(images[0], 'https://finna.fi/').toString();
    });
};
