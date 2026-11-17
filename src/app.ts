import { waitForSecurityAudits } from './util/securityaudit.ts';
import { waitForPasswordResetJobs } from './services/auth.ts';
import express from 'express';
import cors from 'cors';
import { Logger } from './util/logger.ts';
import { errorHandler, ErrorWithStatus } from './util/errorhandler.ts';
import { db } from './db/config.ts';
import { createShareDir } from './util/share.ts';
import { config } from './config.ts';
import { routerV2 } from './routes/router-v2.ts';
import closeWithGrace from 'close-with-grace';
import { initDiscordAuditProcessing, stopDiscordAuditProcessing } from './services/audit.ts';
import { createProfilePictureDir } from './util/profilepicture.ts';
import { initRoleMap } from './db/role.ts';
import { closeShareImagePool } from './util/shareimagepool.ts';
import { createServer } from 'node:http';
import { configureZod } from './util/zod.ts';

configureZod();

type ApplicationState = 'starting' | 'ready' | 'draining';

let state: ApplicationState = 'starting';

const isStarting = () => state === 'starting';

// JSON logs omit the non-enumerable message and stack of nested errors.
const describeError = (error: unknown) => (error instanceof Error ? error.stack : error);

const app = express();

app.set('trust proxy', config.TRUST_PROXY ?? false);

// CORS runs first so cross-origin clients can read the unavailable response.
app.use(cors({ allowedHeaders: ['Content-Type', 'Authorization'] }));

app.use((_req, res, next) => {
  if (state !== 'ready') {
    res.setHeader('Connection', 'close');
    next(new ErrorWithStatus(503, 'maintenance', 'Service is currently unavailable'));
    return;
  }
  next();
});

// Profile import takes large bodies, so its route parses them itself after
// authentication. Everything else, including the public routes, stays small.
const PROFILE_IMPORT_PATH = /^\/api\/v2\/profile\/import\/?$/i;
const parseJson = express.json({ limit: config.REQUEST_BODY_MAX_SIZE });
app.use((req, res, next) => {
  if (PROFILE_IMPORT_PATH.test(req.path)) {
    next();
    return;
  }
  parseJson(req, res, next);
});

app.use('/api/v2', routerV2);

app.use(errorHandler);

const server = createServer(app);

const grace = closeWithGrace({ logger: Logger }, async ({ err }) => {
  state = 'draining';
  Logger.info('Application draining');

  const errors: unknown[] = [];

  if (err) {
    Logger.error('closeWithGrace', err);
    errors.push(err);
  }

  const cleanup = async (resource: string, close: () => Promise<unknown>) => {
    try {
      await close();
    } catch (error) {
      errors.push(error);
      Logger.error(`Failed to close ${resource}`, { error: describeError(error) });
    }
  };

  // Startup logs its own failure; recording it makes shutdown exit with failure.
  await startup.catch((error: unknown) => {
    errors.push(error);
  });
  await cleanup('HTTP server', () => {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    server.close((error) => {
      // Startup can fail or be interrupted before the server starts listening.
      if (error && !('code' in error && error.code === 'ERR_SERVER_NOT_RUNNING')) reject(error);
      else resolve();
    });
    return promise;
  });

  await cleanup('Discord audit processor', stopDiscordAuditProcessing);
  await cleanup('share image pool', closeShareImagePool);
  await cleanup('password reset jobs', waitForPasswordResetJobs);
  await cleanup('security audit jobs', waitForSecurityAudits);
  await cleanup('database pool', () => db.$pool.end());

  Logger.info('Application stopped');

  if (errors.length > 0) {
    throw new AggregateError(errors, 'Application shutdown failed');
  }
});

const initialize = async () => {
  await createShareDir();
  if (!isStarting()) return;
  await createProfilePictureDir();
  if (!isStarting()) return;

  // A task acquires and releases its connection even when initialization fails.
  await db.task(async (t) => {
    Logger.info('Connected to database');
    await initRoleMap(t);
  });
  if (!isStarting()) return;
  await initDiscordAuditProcessing();
  if (!isStarting()) return;

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.once('error', reject);
  server.listen(config.PORT, () => {
    server.off('error', reject);
    resolve();
  });
  await promise;
  if (!isStarting()) return;
  state = 'ready';
  Logger.info(`Application ready and listening on port ${config.PORT}`);
};

const startup = initialize();
void startup.catch((error: unknown) => {
  Logger.error('Application startup failed', { error: describeError(error) });
  // Shutdown also observes the rejected startup promise, so a manual close exits
  // with failure after cleanup rather than reporting successful termination.
  if (isStarting()) grace.close();
});

export default app;
