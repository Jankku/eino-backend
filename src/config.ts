import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const nonEmptyString = z.string().min(1);

const configSchema = z.object({
  NODE_ENV: z.optional(nonEmptyString).default('development'),
  DATABASE_URL: z
    .string()
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      "Must start with 'postgres://' or 'postgresql://'",
    ),
  POSTGRES_USER: nonEmptyString,
  POSTGRES_PASSWORD: nonEmptyString,
  POSTGRES_DB: nonEmptyString,
  PORT: z.coerce.number().positive().default(5000),
  TMDB_API_KEY: z.optional(nonEmptyString),
  EMAIL_SENDER: z.optional(z.string().email().min(1)),
  EMAIL_MAILTRAP_TOKEN: z.optional(nonEmptyString),
  EMAIL_MAILTRAP_TEST_INBOX_ID: z.optional(z.coerce.number().positive()),
  ACCESS_TOKEN_SECRET: nonEmptyString,
  ACCESS_TOKEN_VALIDITY: nonEmptyString,
  REFRESH_TOKEN_SECRET: nonEmptyString,
  REFRESH_TOKEN_VALIDITY: nonEmptyString,
  REQUEST_BODY_MAX_SIZE: z.optional(nonEmptyString).default('10mb'),
  USER_LIST_ITEM_MAX_COUNT: z.coerce.number().positive().default(100_000),
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  console.log(result.error.errors);
  throw new Error('Invalid configuration');
}

export const config = { ...result.data, isProduction: result.data.NODE_ENV === 'production' };
