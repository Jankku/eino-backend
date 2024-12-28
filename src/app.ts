import express from 'express';
import cors from 'cors';
import { Logger } from './util/logger';
import { errorHandler, ErrorWithStatus } from './util/errorhandler';
import { db } from './db/config';
import { createShareDir } from './util/share';
import { config } from './config';
import { routerV1 } from './routes/router-v1';
import { routerV2 } from './routes/router-v2';
import { initZxcvbn } from './util/auth';
import closeWithGrace from 'close-with-grace';
import { initDiscordAuditProcessing } from './services/audit';
import { createProfilePictureDir } from './util/profilepicture';
import { initRoleMap } from './db/role';

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

app.use('/api/v1', routerV1);
app.use('/api/v2', routerV2);

app.use(errorHandler);

const server = app.listen(config.PORT, () =>
  Logger.info(`Server Listening to port ${config.PORT}`),
);

db.connect()
  .then(async (c) => {
    Logger.info('Connected to database');
    await c.task(initRoleMap);
    await c.done();
  })
  .catch((error: Error) => {
    Logger.error('Error connecting to database', { error });
    throw error;
  });

closeWithGrace({ logger: Logger }, ({ err }) => {
  if (err) {
    Logger.error('closeWithGrace', err);
  }
  db.$pool.end(() => Logger.info('Pool has ended'));
  server.close(() => Logger.info('Server closed'));
});

export default app;
