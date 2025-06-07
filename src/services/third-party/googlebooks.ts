import axios from 'axios';
import { z } from 'zod';
import { BookFormSchema } from '../../db/model/book';
import { DateTime } from 'luxon';
import { languageCodeSchema } from '../../util/zodschema';

const googleBooksSchema = z.object({
  items: z.array(
    z.object({
      volumeInfo: z.object({
        title: z.string(),
        authors: z.array(z.string()),
        publisher: z.string(),
        publishedDate: z.string().date(),
        industryIdentifiers: z.array(
          z.object({ type: z.enum(['ISBN_10', 'ISBN_13']), identifier: z.string() }),
        ),
        pageCount: z.number(),
        language: languageCodeSchema,
        imageLinks: z.object({ thumbnail: z.string() }),
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
    image_url: volumeInfo.imageLinks.thumbnail,
    pages: volumeInfo.pageCount,
    year: DateTime.fromISO(volumeInfo.publishedDate).year,
    language_code: volumeInfo.language,
  };
};

export const fetchGoogleBooksByIsbn = async (isbn: string): Promise<BookFormSchema[]> => {
  const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
    params: { q: `isbn:${isbn}` },
  });
  const validated = googleBooksSchema.safeParse(response.data);
  if (!validated.success) {
    return [];
  }
  return validated.data.items.map((book) => googleBookToBook(book));
};
