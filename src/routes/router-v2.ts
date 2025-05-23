import express from 'express';
import { authRouter } from './auth';
import { adminRouter } from './admin';
import { bookRouter } from './books';
import { movieRouter } from './movies';
import { profileRouterV2 } from './profile';
import { profilePictureRouter } from './profilepicture';
import { shareRouter } from './share';
import { emailRouter } from './email';
import { verifyToken } from '../middleware/verifytoken';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';
import { readFileSync } from 'node:fs';
import { requireAdmin } from '../middleware/requirerole';
import { userEnabled } from '../middleware/userenabled';
import { bulletinsRouter } from './bulletins';

export const routerV2 = express.Router();

const swaggerDocs = yaml.parse(readFileSync('./src/docs-v2.yaml', 'utf8')) as Record<
  string,
  unknown
>;
routerV2.use('/docs', swaggerUi.serveFiles(swaggerDocs));
routerV2.get('/docs', swaggerUi.setup(swaggerDocs, { customSiteTitle: 'Eino API Docs v2' }));
routerV2.get('/docs.json', (_, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

routerV2.use('/auth', authRouter);
routerV2.use('/admin', verifyToken, userEnabled, requireAdmin, adminRouter);
routerV2.use('/list/books', verifyToken, userEnabled, bookRouter);
routerV2.use('/list/movies', verifyToken, userEnabled, movieRouter);
routerV2.use('/profile', verifyToken, userEnabled, profileRouterV2);
routerV2.use('/profilepicture', profilePictureRouter);
routerV2.use('/share', shareRouter);
routerV2.use('/email', verifyToken, userEnabled, emailRouter);
routerV2.use('/bulletins', bulletinsRouter);
