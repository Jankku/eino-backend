import express from 'express';
import { authRouter } from './auth/index.ts';
import { adminRouter } from './admin/index.ts';
import { bookRouterV2 } from './books/index.ts';
import { movieRouterV2 } from './movies/index.ts';
import { profileRouterV2 } from './profile/index.ts';
import { profilePictureRouter } from './profilepicture/index.ts';
import { shareRouter } from './share/index.ts';
import { emailRouter } from './email/index.ts';
import { verifyToken } from '../middleware/verifytoken.ts';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { requireAdmin } from '../middleware/requirerole.ts';
import { userEnabled } from '../middleware/userenabled.ts';
import { bulletinsRouter } from './bulletins/index.ts';

export const routerV2 = express.Router();

const swaggerDocs = z
  .record(z.string(), z.unknown())
  .parse(yaml.parse(readFileSync('./src/docs-v2.yaml', 'utf8')));
routerV2.use('/docs', swaggerUi.serveFiles(swaggerDocs));
routerV2.get('/docs', swaggerUi.setup(swaggerDocs, { customSiteTitle: 'Eino API Docs v2' }));
routerV2.get('/docs.json', (_, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

routerV2.use('/auth', authRouter);
routerV2.use('/admin', verifyToken, userEnabled, requireAdmin, adminRouter);
routerV2.use('/list/books', verifyToken, userEnabled, bookRouterV2);
routerV2.use('/list/movies', verifyToken, userEnabled, movieRouterV2);
routerV2.use('/profile', verifyToken, userEnabled, profileRouterV2);
routerV2.use('/profilepicture', profilePictureRouter);
routerV2.use('/share', shareRouter);
routerV2.use('/email', verifyToken, userEnabled, emailRouter);
routerV2.use('/bulletins', bulletinsRouter);
