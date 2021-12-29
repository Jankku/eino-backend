import { NextFunction, Request, Response } from 'express';
import { clearErrors } from './validation';

class ErrorWithStatus extends Error {
  status: number;

  constructor(status: number, name: string, message: string) {
    super();
    this.status = status;
    this.name = name;
    this.message = message;
  }
}

const errorHandler = (
  errors: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  if (errors instanceof Array) {
    res.status(422).json({ errors });
  } else if (errors instanceof ErrorWithStatus) {
    const { status, name, message } = errors;
    res.status(status).json({ errors: [{ name, message }] });
  }

  clearErrors();
};

export { ErrorWithStatus, errorHandler };
