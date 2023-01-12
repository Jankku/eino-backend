import { ZodError, ZodIssue } from 'zod';

export const formatZodErrors = (error: ZodError) => {
  const errors = Object.values(error.issues);
  const formattedErrors = errors.map((e: ZodIssue) => {
    const isCustom = e.code === 'custom';
    const code = isCustom ? e?.params?.name : null;
    const name = code ?? e.code;
    return {
      name: name,
      message: e.message,
    };
  });

  return formattedErrors;
};
