import express from 'express';
import authRouter from './auth';
import bookRouter from './books';
import movieRouter from './movies';
import profileRouter from './profile';
import shareRouter from './share';
import verifyToken from '../middleware/verifytoken';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';
import { readFileSync } from 'node:fs';

const routerV1 = express.Router();

const swaggerDocs = yaml.parse(readFileSync('./src/docs-v1.yaml', 'utf8'));
routerV1.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
routerV1.use('/docs.json', (_, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

routerV1.use('/auth', authRouter);
routerV1.use('/list/books', verifyToken, bookRouter);
routerV1.use('/list/movies', verifyToken, movieRouter);
routerV1.use('/profile', verifyToken, profileRouter);
routerV1.use('/share', shareRouter);

export default routerV1;
