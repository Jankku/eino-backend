import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import Logger from './util/logger';
import { errorHandler } from './util/errorhandler';
import verifyToken from './middleware/authorization';
import authRoutes from './routes/authentication';
import listRoutes from './routes/list';
import profileRoutes from './routes/profile';
import shareRoutes from './routes/share';
import { pool } from './db/config';
import { createShareDir } from './util/share';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(helmet());
app.use(cors({ allowedHeaders: ['Content-Type', 'Authorization'] }));

app.use('/api/auth', authRoutes);
app.use('/api/list', verifyToken, listRoutes);
app.use('/api/profile', verifyToken, profileRoutes);
app.use('/api/share', shareRoutes);

createShareDir();

app.use(errorHandler);

app.listen(port, () => Logger.info(`Server Listening to port ${port}`));

process.on('uncaughtException', (error) => {
  Logger.error('uncaughtException', error);
  pool.end(() => Logger.info('Pool has ended'));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('unhandledRejection', reason);
});

export default app;
