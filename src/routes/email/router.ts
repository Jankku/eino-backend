import express from 'express';
import { validateSchema } from '../../middleware/validateschema.ts';
import { updateEmailSchema, verifyEmailSchema } from './schema.ts';
import * as email from '../../services/email.ts';

export const emailRouter = express.Router();

emailRouter.post('/update', validateSchema(updateEmailSchema, 'email_update'), email.updateEmail);
emailRouter.post('/sendconfirmation', email.sendConfirmationEmail);
emailRouter.post('/verify', validateSchema(verifyEmailSchema, 'email_verify'), email.verifyEmail);
