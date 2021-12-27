import { NextFunction, Request, Response } from "express";
import { clearErrors } from "./validation";

class ErrorHandler extends Error {
  status: number;

  constructor(status: number, name: string, message: string) {
    super();
    this.status = status;
    this.name = name;
    this.message = message;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorResponder = (
  errors: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (errors instanceof Array) {
    res.status(422).json({ errors });
  } else {
    const { status, name, message } = errors;
    res.status(status).json({ errors: [{ name, message }] });
  }

  clearErrors();
};

export { ErrorHandler, errorResponder };
