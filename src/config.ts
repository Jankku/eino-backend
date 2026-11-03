import { z } from 'zod';
import { loadEnvFile } from 'node:process';
import { nonEmptyString } from './util/zodschema.ts';

try {
  loadEnvFile();
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
    throw error;
  }
}

const tokenSecretSchema = nonEmptyString.refine(
  (value) => value === value.trim() && Buffer.byteLength(value, 'utf8') >= 32,
  'Must contain at least 32 UTF-8 bytes with no surrounding whitespace; use a randomly generated secret',
);

const tokenValiditySchema = z
  .string()
  .trim()
  .regex(
    /^\d+(?:[smhdw])?$/,
    'Must be seconds or a whole-number duration with unit s, m, h, d, or w',
  )
  .transform((value) => {
    const amount = Number.parseInt(value, 10);
    switch (value.at(-1)) {
      case 'm': {
        return amount * 60;
      }
      case 'h': {
        return amount * 60 * 60;
      }
      case 'd': {
        return amount * 60 * 60 * 24;
      }
      case 'w': {
        return amount * 60 * 60 * 24 * 7;
      }
      default: {
        return amount;
      }
    }
  })
  .pipe(z.int().positive());

const configSchema = z
  .object({
    NODE_ENV: z.optional(nonEmptyString.toLowerCase()).default('development'),
    DATABASE_URL: nonEmptyString.refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      "Must start with 'postgres://' or 'postgresql://'",
    ),
    POSTGRES_USER: nonEmptyString,
    POSTGRES_PASSWORD: nonEmptyString,
    POSTGRES_DB: nonEmptyString,
    PORT: z.coerce.number().positive().default(5000),
    TMDB_API_KEY: z.optional(nonEmptyString),
    GOOGLE_BOOKS_API_KEY: z.optional(nonEmptyString),
    EMAIL_SENDER: z.optional(z.email().min(1)),
    EMAIL_MAILTRAP_TOKEN: z.optional(nonEmptyString),
    EMAIL_MAILTRAP_TEST_INBOX_ID: z.optional(z.coerce.number().positive()),
    DISCORD_AUDIT_LOG_WEBHOOK_URL: z.optional(
      nonEmptyString.refine(
        (value) => value.startsWith('https://discord.com/api/webhooks/'),
        "Must start with 'https://discord.com/api/webhooks/'",
      ),
    ),
    ACCESS_TOKEN_SECRET: tokenSecretSchema,
    ACCESS_TOKEN_VALIDITY: tokenValiditySchema,
    REFRESH_TOKEN_SECRET: tokenSecretSchema,
    REFRESH_TOKEN_VALIDITY: tokenValiditySchema,
    REQUEST_BODY_MAX_SIZE: z.optional(nonEmptyString).default('10mb'),
    USER_LIST_ITEM_MAX_COUNT: z.coerce.number().positive().default(100_000),
  })
  .refine((value) => value.ACCESS_TOKEN_SECRET !== value.REFRESH_TOKEN_SECRET, {
    path: ['REFRESH_TOKEN_SECRET'],
    message: 'Must differ from ACCESS_TOKEN_SECRET',
  });

const { success, data, error } = configSchema.safeParse(process.env);

if (!success) {
  console.error(z.prettifyError(error));
  throw new Error('Invalid configuration');
}

export const config = { ...data, isProduction: data.NODE_ENV === 'production' };
