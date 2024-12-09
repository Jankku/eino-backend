import express from 'express';
import * as admin from '../../services/admin';
import { validateSchema } from '../../middleware/validateschema';
import { deleteUserSchema, disableUserSchema, editUserSchema, enableUserSchema } from './schema';

export const adminRouter = express.Router();

adminRouter.get('/users', admin.getUsers);
adminRouter.post('/users/:userId/enable', validateSchema(enableUserSchema), admin.enableUser);
adminRouter.post('/users/:userId/disable', validateSchema(disableUserSchema), admin.disableUser);
adminRouter.put('/users/:userId', validateSchema(editUserSchema), admin.editUser);
adminRouter.delete('/users/:userId', validateSchema(deleteUserSchema), admin.deleteUser);
adminRouter.get('/audits', admin.getAuditLogs);