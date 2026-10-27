import { z } from 'zod';
import { ZodError } from 'zod/v4';
import { $ZodIssue } from 'zod/v4/core';
import { Response } from 'express';
import { Role } from '../db/role';

type AuthLocals = {
  userId: string;
  isDisabled: boolean;
  username: string;
  role: Role['name'];
};

export type TypedResponse<T extends z.ZodType = never> = Response<
  unknown,
  AuthLocals & ([T] extends [never] ? object : { input: z.output<T> })
>;

export const formatZodErrors = (error: ZodError) => {
  const errors = Object.values(error.issues);
  const formattedErrors = errors.map((e: $ZodIssue) => {
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
