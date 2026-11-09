import { waitForSecurityAudits } from './util/securityaudit.ts';
import { waitForPasswordResetJobs } from './services/auth.ts';
import express from 'express';
import cors from 'cors';
import { Logger } from './util/logger.ts';
import { errorHandler, ErrorWithStatus } from './util/errorhandler.ts';
import { db } from './db/config.ts';
import { createShareDir } from './util/share.ts';
import { config } from './config.ts';
import { routerV1 } from './routes/router-v1.ts';
import { routerV2 } from './routes/router-v2.ts';
import closeWithGrace from 'close-with-grace';
import { initDiscordAuditProcessing, stopDiscordAuditProcessing } from './services/audit.ts';
import { createProfilePictureDir } from './util/profilepicture.ts';
import { initRoleMap } from './db/role.ts';
import { closeShareImagePool } from './util/shareimagepool.ts';

createShareDir().catch((error) => Logger.error('Error creating share dir', { error }));
createProfilePictureDir().catch((error) =>
  Logger.error('Error creating profile picture dir', { error }),
);

const app = express();

app.set('trust proxy', config.TRUST_PROXY ?? false);

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
    await initDiscordAuditProcessing();
    await c.task(initRoleMap);
    await c.done();
  })
  .catch((error: Error) => {
    Logger.error('Error connecting to database', { error });
    throw error;
  });

closeWithGrace({ logger: Logger }, async ({ err }) => {
  if (err) {
    Logger.error('closeWithGrace', err);
  }
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.close((error) => {
    if (error) reject(error);
    else resolve();
  });
  await promise;
  Logger.info('Server closed');
  await stopDiscordAuditProcessing();
  await closeShareImagePool();
  Logger.info('Share image pool closed');
  await waitForPasswordResetJobs();
  await waitForSecurityAudits();
  await db.$pool.end();
  Logger.info('Database pool closed');
});

export default app;
