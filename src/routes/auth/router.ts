import express from 'express';
import { validateSchema } from '../../middleware/validateschema';
import * as auth from '../../services/auth';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  passwordStrengthSchema,
  loginConfigSchema,
  enable2FASchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './schema';
import { verifyToken } from '../../middleware/verifytoken';
import { userEnabled } from '../../middleware/userenabled';

export const authRouter = express.Router();

authRouter.post('/register', validateSchema(registerSchema), auth.register);
authRouter.post('/login', validateSchema(loginSchema), auth.login);
authRouter.post('/login/config', validateSchema(loginConfigSchema), auth.loginConfig);
authRouter.post('/refreshtoken', validateSchema(refreshTokenSchema), auth.generateNewAccessToken);
authRouter.post('/passwordstrength', validateSchema(passwordStrengthSchema), auth.passwordStrength);
authRouter.post('/password/forgot', validateSchema(forgotPasswordSchema), auth.forgotPassword);
authRouter.post('/password/reset', validateSchema(resetPasswordSchema), auth.resetPassword);

authRouter.post('/2fa/generate', verifyToken, userEnabled, auth.generate2FAUrl);
authRouter.post(
  '/2fa/enable',
  verifyToken,
  userEnabled,
  validateSchema(enable2FASchema),
  auth.enable2FA,
);
authRouter.post(
  '/2fa/disable',
  verifyToken,
  userEnabled,
  validateSchema(enable2FASchema),
  auth.disable2FA,
);
