import express from 'express';
import * as bulletins from '../../services/bulletins.ts';
import { userEnabled } from '../../middleware/userenabled.ts';
import { verifyToken } from '../../middleware/verifytoken.ts';

export const bulletinsRouter = express.Router();

bulletinsRouter.get('/public', bulletins.publicBulletins);
bulletinsRouter.get('/user', verifyToken, userEnabled, bulletins.userBulletins);
