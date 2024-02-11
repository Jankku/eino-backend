import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import Logger from './util/logger';
import { errorHandler } from './util/errorhandler';
import verifyToken from './middleware/verifytoken';
import { db } from './db/config';
import { createShareDir } from './util/share';
import { authRouter } from './routes/auth';
import { bookRouter } from './routes/books';
import { movieRouter } from './routes/movies';
import { profileRouter } from './routes/profile';
import { shareRouter } from './routes/share';
import { config } from './config';
import { routerV1 } from './routes/router-v1';
import { routerV2 } from './routes/router-v2';
import { initZxcvbn } from './util/auth';

initZxcvbn();
createShareDir();

const app = express();

app.use(express.json({ limit: config.JSON_BODY_SIZE_LIMIT }));
app.use(helmet());
app.use(cors({ allowedHeaders: ['Content-Type', 'Authorization'] }));

// No v1 path for backwards compatibility
app.use('/api/auth', authRouter);
app.use('/api/list/books', verifyToken, bookRouter);
app.use('/api/list/movies', verifyToken, movieRouter);
app.use('/api/profile', verifyToken, profileRouter);
app.use('/api/share', shareRouter);

app.use('/api/v1', routerV1);
app.use('/api/v2', routerV2);

app.use(errorHandler);

app.listen(config.PORT, () => Logger.info(`Server Listening to port ${config.PORT}`));

process.on('uncaughtException', (error) => {
  Logger.error('uncaughtException', error);
  db.$pool.end(() => Logger.info('Pool has ended'));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('unhandledRejection', reason);
});

export default app;
