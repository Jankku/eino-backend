import express from 'express';
import * as admin from '../../services/admin';
import { validateSchema } from '../../middleware/validateschema';
import { deleteUserSchema } from './schema';

export const adminRouter = express.Router();

adminRouter.get('/users', admin.getUsers);
adminRouter.delete('/users/:userId', validateSchema(deleteUserSchema), admin.deleteUser);
adminRouter.get('/audits', admin.getAuditLogs);
