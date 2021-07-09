import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import Logger from './util/logger';

// Middlewares
import verifyToken from './middleware/authorization';

// Routes
import authRoutes from './routes/authentication';
import movieRoutes from './routes/movies';
import bookRoutes from './routes/books';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(helmet());
app.use(cors({ allowedHeaders: ['Content-Type', 'Authorization'] }));

// Routes
app.use('/api/auth', authRoutes);

// These routes need JWT authorization token
app.use('/api/books', verifyToken, bookRoutes);
app.use('/api/movies', verifyToken, movieRoutes);

app.listen(port, () => {
  Logger.info(`Server Listening to port ${port}`);
});

export default app;
