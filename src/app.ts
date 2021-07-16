import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import Logger from './util/logger';
import { errorResponder } from './util/errorhandler';
import verifyToken from './middleware/authorization';
import authRoutes from './routes/authentication';
import listRoutes from './routes/list';
import movieRoutes from './routes/movies';
import bookRoutes from './routes/books';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(helmet());
app.use(cors({ allowedHeaders: ['Content-Type', 'Authorization'] }));

app.use('/api/auth', authRoutes);
app.use('/api/list', verifyToken, listRoutes);
app.use('/api/books', verifyToken, bookRoutes);
app.use('/api/movies', verifyToken, movieRoutes);

app.use(errorResponder);

app.listen(port, () => {
  Logger.info(`Server Listening to port ${port}`);
});

process.on('uncaughtException', (err: Error) => {
  Logger.error(err);
});

process.on('unhandledRejection', (reason) => {
  Logger.error(reason);
});

export default app;
