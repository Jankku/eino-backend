import express from 'express';
import { authRouter } from './auth/index.ts';
import { bookRouter } from './books/index.ts';
import { movieRouter } from './movies/index.ts';
import { profileRouter } from './profile/index.ts';
import { shareRouter } from './share/index.ts';
import { verifyToken } from '../middleware/verifytoken.ts';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { userEnabled } from '../middleware/userenabled.ts';

export const routerV1 = express.Router();

const swaggerDocs = z
  .record(z.string(), z.unknown())
  .parse(yaml.parse(readFileSync('./src/docs-v1.yaml', 'utf8')));
routerV1.use('/docs', swaggerUi.serveFiles(swaggerDocs));
routerV1.get('/docs', swaggerUi.setup(swaggerDocs, { customSiteTitle: 'Eino API Docs v1' }));
routerV1.get('/docs.json', (_, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

routerV1.use('/auth', authRouter);
routerV1.use('/list/books', verifyToken, userEnabled, bookRouter);
routerV1.use('/list/movies', verifyToken, userEnabled, movieRouter);
routerV1.use('/profile', verifyToken, userEnabled, profileRouter);
routerV1.use('/share', shareRouter);
