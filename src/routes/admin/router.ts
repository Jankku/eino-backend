import express from 'express';
import * as admin from '../../services/admin';
import { validateSchema } from '../../middleware/validateschema';
import { validatePagination } from '../../middleware/pagination';
import {
  createBulletinSchema,
  deleteBulletinSchema,
  deleteUserSchema,
  disableUserSchema,
  editBulletinSchema,
  editUserSchema,
  enableUserSchema,
  overviewSchema,
  auditQuerySchema,
} from './schema';

export const adminRouter = express.Router();

adminRouter.get('/overview', validateSchema(overviewSchema), admin.getOverview);
adminRouter.get('/users', validatePagination(), admin.getUsers);
adminRouter.post('/users/:userId/enable', validateSchema(enableUserSchema), admin.enableUser);
adminRouter.post('/users/:userId/disable', validateSchema(disableUserSchema), admin.disableUser);
adminRouter.put('/users/:userId', validateSchema(editUserSchema), admin.editUser);
adminRouter.delete('/users/:userId', validateSchema(deleteUserSchema), admin.deleteUser);
adminRouter.get(
  '/audits',
  validateSchema(auditQuerySchema),
  validatePagination(),
  admin.getAuditLogs,
);
adminRouter.get('/bulletins', validatePagination(), admin.getBulletins);
adminRouter.post('/bulletins', validateSchema(createBulletinSchema), admin.postBulletin);
adminRouter.put('/bulletins/:bulletinId', validateSchema(editBulletinSchema), admin.editBulletin);
adminRouter.delete(
  '/bulletins/:bulletinId',
  validateSchema(deleteBulletinSchema),
  admin.removeBulletin,
);
