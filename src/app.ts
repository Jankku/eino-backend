import express from 'express';
import cors from 'cors';
import Logger from './util/logger';
import { errorHandler, ErrorWithStatus } from './util/errorhandler';
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
import closeWithGrace from 'close-with-grace';
import { initDiscordAuditProcessing } from './services/audit';
import { createProfilePictureDir } from './util/profilepicture';

initZxcvbn();
createShareDir().catch((error) => Logger.error('Error creating share dir', { error }));
createProfilePictureDir().catch((error) =>
  Logger.error('Error creating profile picture dir', { error }),
);
initDiscordAuditProcessing();

const app = express();

app.use(express.json({ limit: config.REQUEST_BODY_MAX_SIZE }));
app.use(cors({ allowedHeaders: ['Content-Type', 'Authorization'] }));

// Prevent requests when server is closing
app.use((_req, _res, next) => {
  // @ts-expect-error - no types
  if (closeWithGrace.closing) {
    next(new ErrorWithStatus(503, 'maintenance', 'Service is currently unavailable'));
    return;
  }
  next();
});

// No v1 path for backwards compatibility
app.use('/api/auth', authRouter);
app.use('/api/list/books', verifyToken, bookRouter);
app.use('/api/list/movies', verifyToken, movieRouter);
app.use('/api/profile', verifyToken, profileRouter);
app.use('/api/share', shareRouter);

app.use('/api/v1', routerV1);
app.use('/api/v2', routerV2);

app.use(errorHandler);

const server = app.listen(config.PORT, () =>
  Logger.info(`Server Listening to port ${config.PORT}`),
);

closeWithGrace({ logger: Logger }, ({ err }) => {
  if (err) {
    Logger.error('closeWithGrace', err);
  }
  db.$pool.end(() => Logger.info('Pool has ended'));
  server.close(() => Logger.info('Server closed'));
});

export default app;
