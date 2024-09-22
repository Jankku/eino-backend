import express from 'express';
import { validateSchema } from '../../middleware/validateschema';
import { updateEmailSchema, verifyEmailSchema } from './schema';
import * as email from '../../services/email';

export const emailRouter = express.Router();

emailRouter.post('/update', validateSchema(updateEmailSchema), email.updateEmail);
emailRouter.post('/sendconfirmation', email.sendConfirmationEmail);
emailRouter.post('/verify', validateSchema(verifyEmailSchema), email.verifyEmail);
