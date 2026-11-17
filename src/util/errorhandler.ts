import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { pgp } from '../db/config.ts';
import { Logger } from './logger.ts';
import { errorMessages } from './errormessages.ts';
import { auditSecurityFailureAfterResponse, type SecurityFailure } from './securityaudit.ts';

export class ErrorWithStatus extends Error {
  status: number;

  constructor(status: number, name: string, message: string) {
    super();
    this.status = status;
    this.name = name;
    this.message = message;
  }
}

export class SecurityErrorWithStatus extends ErrorWithStatus {
  audit: SecurityFailure;

  constructor(status: number, name: string, message: string, audit: SecurityFailure) {
    super(status, name, message);
    this.audit = audit;
  }
}

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const uniqueConstraintMessages: Record<string, string> = {
  users_username_key: errorMessages.USER_EXISTS,
  users_username_lower_key: errorMessages.USER_EXISTS,
  users_email_verified_key: errorMessages.EMAIL_ALREADY_USED,
};

// Only references that come from request input. Any other violation is a server bug.
const foreignKeyConstraintMessages: Record<string, string> = {
  users_role_id_fkey: "Role doesn't exist",
  bulletin_users_user_id_fkey: "User doesn't exist",
};

type DatabaseError = Error & { code: string; constraint?: string };

const isDatabaseError = (error: unknown, code: string): error is DatabaseError =>
  error instanceof Error && 'code' in error && error.code === code;

// Errors from Express's body parser, such as malformed JSON (400) or a too large body (413).
const exposedClientErrorSchema = z.object({
  status: z.int().min(400).max(499),
  expose: z.literal(true),
  message: z.string(),
  type: z.string().optional(),
});

const toErrorWithStatus = (error: unknown): ErrorWithStatus | undefined => {
  if (error instanceof ErrorWithStatus) return error;

  if (
    error instanceof pgp.errors.QueryResultError &&
    error.code === pgp.errors.queryResultErrorCode.noData
  ) {
    return new ErrorWithStatus(404, 'not_found', 'Resource not found');
  }

  if (isDatabaseError(error, UNIQUE_VIOLATION)) {
    const message =
      (error.constraint && uniqueConstraintMessages[error.constraint]) ?? 'Resource already exists';
    return new ErrorWithStatus(409, 'conflict', message);
  }

  if (isDatabaseError(error, FOREIGN_KEY_VIOLATION)) {
    const message = error.constraint && foreignKeyConstraintMessages[error.constraint];
    if (message) return new ErrorWithStatus(422, 'invalid_reference', message);
  }

  const clientError = exposedClientErrorSchema.safeParse(error);
  if (clientError.success) {
    const { status, message, type } = clientError.data;
    return new ErrorWithStatus(status, type?.replaceAll('.', '_') ?? 'bad_request', message);
  }

  return undefined;
};

export const errorHandler = (errors: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(errors);
    return;
  }

  if (Array.isArray(errors)) {
    res.status(422).json({ errors });
    return;
  }

  if (errors instanceof SecurityErrorWithStatus) {
    auditSecurityFailureAfterResponse(req, res, errors.audit);
  }

  const error = toErrorWithStatus(errors);
  if (error) {
    const { status, name, message } = error;
    res.status(status).json({ errors: [{ name, message }] });
    return;
  }

  Logger.error('Unhandled request error', {
    error: errors instanceof Error ? errors.stack : typeof errors,
  });
  res.status(500).json({
    errors: [{ name: 'internal_server_error', message: 'Internal server error' }],
  });
};
