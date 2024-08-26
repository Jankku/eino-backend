import { z } from 'zod';
import dotenv from 'dotenv';
import Logger from './util/logger';

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
  ACCESS_TOKEN_SECRET: nonEmptyString,
  ACCESS_TOKEN_VALIDITY: nonEmptyString,
  REFRESH_TOKEN_SECRET: nonEmptyString,
  REFRESH_TOKEN_VALIDITY: nonEmptyString,
  REQUEST_BODY_MAX_SIZE: z.optional(nonEmptyString).default('10mb'),
  USER_LIST_ITEM_MAX_COUNT: z.coerce.number().positive().default(100_000),
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  Logger.error(result.error.issues);
  throw new Error('Invalid configuration');
}

export const config = { ...result.data, isProduction: result.data.NODE_ENV === 'production' };
