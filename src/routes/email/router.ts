import express from 'express';
import validateSchema from '../../middleware/validateschema';
import { updateEmailSchema, verifyEmailSchema } from './schema';
import { updateEmail, verifyEmail } from '../../services/email';

export const emailRouter = express.Router();

emailRouter.post('/update', validateSchema(updateEmailSchema), updateEmail);
emailRouter.post('/verify', validateSchema(verifyEmailSchema), verifyEmail);
