import axios from 'axios';
import { z } from 'zod';
import { cachified } from '@epic-web/cachified';
import { cache, stringArrayCacheSchema, getCacheKey } from '../../util/cache';
import { BookFormSchema } from '../../db/model/book';
import { LanguageCode } from '../../util/languages';
import { languageCodeSchema } from '../../util/zodschema';
import { DateTime } from 'luxon';
import { Logger } from '../../util/logger';

const numberOrZero = (value: string | undefined) => {
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const numberOrCurrentYear = (value: string | undefined) => {
  if (!value) {
    return DateTime.now().year;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? DateTime.now().year : parsed;
};

const openLibraryEditionSchema = z.object({
  title: z.string(),
  authors: z.array(z.object({ key: z.string() })),
  publishers: z.array(z.string()),
  publish_date: z.string().optional().transform(numberOrCurrentYear), // year only
  isbn_13: z.array(z.string()),
  pagination: z.string().optional().transform(numberOrZero),
  languages: z.array(z.object({ key: z.string() })).optional(), // /languages/eng
  covers: z.array(z.number()),
});

type OpenLibraryEdition = z.infer<typeof openLibraryEditionSchema>;

const openLibraryLanguageSchema = z.object({
  key: z.string(),
  identifiers: z.object({ iso_639_1: z.array(languageCodeSchema) }),
});

const openLibraryAuthorSchema = z.object({
  name: z.string(),
});

const openLibraryImageSchema = z.object({
  numFound: z.number(),
  docs: z.array(z.object({ cover_i: z.number().optional() })),
});

const fetchOpenLibraryAuthorName = async (authorKey: string): Promise<string> => {
  return cachified({
    cache: cache,
    key: getCacheKey('openlibrary-author', authorKey),
    checkValue: z.string(),
    async getFreshValue(context) {
      const response = await axios.get(`https://openlibrary.org${authorKey}.json`);
      const validated = openLibraryAuthorSchema.safeParse(response.data);
      if (!validated.success) {
        context.metadata.ttl = -1;
        throw new Error('Invalid author data from Open Library', { cause: validated.error.cause });
      }
      return validated.data.name;
    },
  });
};

const fetchOpenLibraryLanguageToIso639Code = async (languageKey: string): Promise<LanguageCode> => {
  return cachified({
    cache: cache,
    key: getCacheKey('openlibrary-language', languageKey),
    checkValue: languageCodeSchema,
    async getFreshValue(context) {
      const response = await axios.get(`https://openlibrary.org${languageKey}.json`);
      const validated = openLibraryLanguageSchema.safeParse(response.data);
      if (!validated.success) {
        context.metadata.ttl = -1;
        throw new Error('Invalid language data from Open Library', {
          cause: validated.error.cause,
        });
      }
      return validated.data.identifiers.iso_639_1[0];
    },
  });
};

const openLibraryEditionToBook = (
  book: OpenLibraryEdition,
  author: string,
  languageCode: LanguageCode | undefined,
): BookFormSchema => {
  const { title, publishers, publish_date, isbn_13, covers } = book;
  return {
    title,
    author: author,
    publisher: publishers.join(', '),
    isbn: isbn_13[0],
    image_url:
      covers.length > 0 ? `https://covers.openlibrary.org/b/id/${covers[0]}-M.jpg` : undefined,
    pages: book.pagination,
    year: publish_date,
    language_code: languageCode,
  };
};

export const fetchOpenLibraryEditionsByIsbn = async (isbn: string): Promise<BookFormSchema[]> => {
  const editionResponse = await axios.get(`https://openlibrary.org/isbn/${isbn}.json`);
  const validatedEdition = openLibraryEditionSchema.safeParse(editionResponse.data);
  if (!validatedEdition.success) {
    return [];
  }
  const authorKey = validatedEdition.data.authors[0].key;
  const authorName = await fetchOpenLibraryAuthorName(authorKey);
  const languageKey = validatedEdition.data?.languages?.[0]?.key;
  const languageCode = languageKey
    ? await fetchOpenLibraryLanguageToIso639Code(languageKey)
    : undefined;
  return [openLibraryEditionToBook(validatedEdition.data, authorName, languageCode)];
};

export const fetchOpenLibraryImages = async (query: string): Promise<string[]> => {
  return cachified({
    cache: cache,
    key: getCacheKey('openlibrary-image', query),
    checkValue: stringArrayCacheSchema,
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
        Logger.error('Invalid Open Library image data', {
          error: {
            message: validated.error.message,
            stack: validated.error.stack,
          },
        });
        return [];
      }

      return validated.data.docs
        .filter((item) => item.cover_i !== undefined)
        .map(({ cover_i }) => `https://covers.openlibrary.org/b/id/${cover_i}-M.jpg`);
    },
  });
};
