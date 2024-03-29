import express from 'express';
import { authRouter } from './auth';
import { bookRouter } from './books';
import { movieRouter } from './movies';
import { profileRouterV2 } from './profile';
import { shareRouter } from './share';
import verifyToken from '../middleware/verifytoken';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';
import { readFileSync } from 'node:fs';

export const routerV2 = express.Router();

const swaggerDocs = yaml.parse(readFileSync('./src/docs-v2.yaml', 'utf8'));
routerV2.use('/docs', swaggerUi.serveFiles(swaggerDocs));
routerV2.get('/docs', swaggerUi.setup(swaggerDocs, { customSiteTitle: 'Eino API Docs v2' }));
routerV2.get('/docs.json', (_, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

routerV2.use('/auth', authRouter);
routerV2.use('/list/books', verifyToken, bookRouter);
routerV2.use('/list/movies', verifyToken, movieRouter);
routerV2.use('/profile', verifyToken, profileRouterV2);
routerV2.use('/share', shareRouter);
