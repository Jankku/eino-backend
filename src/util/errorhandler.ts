import { NextFunction, Request, Response } from 'express';
import { Logger } from './logger';
import { auditSecurityFailure, SecurityFailure } from './securityaudit';

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

export const errorHandler = async (
  errors: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    next(errors);
    return;
  }

  if (Array.isArray(errors)) {
    res.status(422).json({ errors });
    return;
  }

  if (errors instanceof SecurityErrorWithStatus) {
    await auditSecurityFailure(req, res, errors.audit);
  }

  if (errors instanceof ErrorWithStatus) {
    const { status, name, message } = errors;
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
