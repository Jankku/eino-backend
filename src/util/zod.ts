import { ZodError, ZodIssue, z } from 'zod';
import { Request, Response } from 'express';
import { Role } from '../db/role';

export type TypedRequest<T extends z.ZodTypeAny> = Omit<Request, 'body' | 'params' | 'query'> & {
  body: z.infer<T> extends { body: unknown } ? z.infer<T>['body'] : never;
  params: z.infer<T> extends { params: unknown } ? z.infer<T>['params'] : never;
  query: z.infer<T> extends { query: unknown } ? z.infer<T>['query'] : never;
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
