import { ZodError, ZodIssue, z } from 'zod';
import { Request, Response } from 'express';
import { Role } from '../db/role';

export type TypedRequest<T extends z.Schema<unknown>> = Omit<
  Request,
  'body' | 'params' | 'query'
> & {
  body: T extends z.Schema<infer B> ? (B extends { body: unknown } ? B['body'] : never) : never;
  params: T extends z.Schema<infer P>
    ? P extends { params: unknown }
      ? P['params']
      : never
    : never;
  query: T extends z.Schema<infer Q> ? (Q extends { query: unknown } ? Q['query'] : never) : never;
};

export type TypedResponse = Response & {
  locals: {
    userId: string;
    username: string;
    role: Role['name'];
    email: string | null;
  };
};

export const formatZodErrors = (error: ZodError) => {
  const errors = Object.values(error.issues);
  const formattedErrors = errors.map((e: ZodIssue) => {
    const isCustom = e.code === 'custom';
    const code = isCustom ? e?.params?.name : undefined;
    const name = code ?? e.code;
    return {
      name: name,
      message: e.message,
    };
  });

  return formattedErrors;
};
