import express from 'express';
import { validateSchema } from '../../middleware/validateschema.ts';
import * as auth from '../../services/auth.ts';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  passwordStrengthSchema,
  loginConfigSchema,
  enable2FASchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './schema.ts';
import { verifyToken } from '../../middleware/verifytoken.ts';
import { userEnabled } from '../../middleware/userenabled.ts';

export const authRouter = express.Router();

authRouter.post('/register', validateSchema(registerSchema), auth.register);
authRouter.post('/login', validateSchema(loginSchema, 'login'), auth.login);
authRouter.post(
  '/login/config',
  validateSchema(loginConfigSchema, 'login_config'),
  auth.loginConfig,
);
authRouter.post(
  '/refreshtoken',
  validateSchema(refreshTokenSchema, 'refresh_token'),
  auth.generateNewAccessToken,
);
authRouter.post('/passwordstrength', validateSchema(passwordStrengthSchema), auth.passwordStrength);
authRouter.post(
  '/password/forgot',
  validateSchema(forgotPasswordSchema, 'password_forgot'),
  auth.forgotPassword,
);
authRouter.post(
  '/password/reset',
  validateSchema(resetPasswordSchema, 'password_reset'),
  auth.resetPassword,
);

authRouter.post('/2fa/generate', verifyToken, userEnabled, auth.generate2FAUrl);
authRouter.post(
  '/2fa/enable',
  verifyToken,
  userEnabled,
  validateSchema(enable2FASchema, 'two_factor_enable'),
  auth.enable2FA,
);
authRouter.post(
  '/2fa/disable',
  verifyToken,
  userEnabled,
  validateSchema(enable2FASchema, 'two_factor_disable'),
  auth.disable2FA,
);
