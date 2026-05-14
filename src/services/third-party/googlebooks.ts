import axios from 'axios';
import { z } from 'zod';
import { BookFormSchema } from '../../db/model/book';
import { DateTime } from 'luxon';
import { languageCodeSchema } from '../../util/zodschema';
import { config } from '../../config';

const googleBooksSchema = z.object({
  items: z.array(
    z.object({
      volumeInfo: z.object({
        title: z.string(),
        authors: z.array(z.string()),
        publisher: z.string().optional().default(''),
        publishedDate: z.string().transform((value) => {
          const isoDate = DateTime.fromISO(value);
          if (isoDate.isValid) {
            return isoDate;
          }
          const isoYear = DateTime.fromFormat(value, 'yyyy');
          return isoYear.isValid ? isoYear : DateTime.now();
        }),
        industryIdentifiers: z.array(
          z.object({ type: z.enum(['ISBN_10', 'ISBN_13']), identifier: z.string() }),
        ),
        pageCount: z.number(),
        language: languageCodeSchema,
        imageLinks: z.object({ thumbnail: z.string() }).optional(),
      }),
    }),
  ),
});

type GoogleBook = z.infer<typeof googleBooksSchema>['items'][number];

const getIsbn = ({ volumeInfo }: GoogleBook): string => {
  const isbn13 = volumeInfo.industryIdentifiers.find((id) => id.type === 'ISBN_13');
  const isbn10 = volumeInfo.industryIdentifiers.find((id) => id.type === 'ISBN_10');
  return isbn13?.identifier || isbn10?.identifier || '';
};

const googleBookToBook = (book: GoogleBook): BookFormSchema => {
  const { volumeInfo } = book;
  return {
    title: volumeInfo.title,
    author: volumeInfo.authors.join(', '),
    publisher: volumeInfo.publisher,
    isbn: getIsbn(book),
    image_url: volumeInfo.imageLinks?.thumbnail,
    pages: volumeInfo.pageCount,
    year: volumeInfo.publishedDate.year,
    language_code: volumeInfo.language,
  };
};

export const fetchGoogleBooksByIsbn = async (isbn: string): Promise<BookFormSchema[]> => {
  if (!config.GOOGLE_BOOKS_API_KEY) {
    return [];
  }
  const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
    params: {
      key: config.GOOGLE_BOOKS_API_KEY,
      q: `isbn:${isbn}`,
      maxResults: 5,
    },
  });
  const validated = googleBooksSchema.safeParse(response.data);
  if (!validated.success) {
    return [];
  }
  return validated.data.items.map((book) => googleBookToBook(book));
};
