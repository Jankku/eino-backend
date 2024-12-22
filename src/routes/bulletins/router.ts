import express from 'express';
import * as bulletins from '../../services/bulletins';
import { userEnabled } from '../../middleware/userenabled';
import { verifyToken } from '../../middleware/verifytoken';

export const bulletinsRouter = express.Router();

bulletinsRouter.get('/public', bulletins.publicBulletins);
bulletinsRouter.get('/user', verifyToken, userEnabled, bulletins.userBulletins);
