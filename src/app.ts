import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

// Middlewares
import verifyToken from './middleware/authorization';

// Routes
import authRoutes from './routes/authentication';
import movieRoutes from './routes/movies';
import bookRoutes from './routes/books';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(compression());
app.use(helmet());
app.use(cors({
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use('/auth', authRoutes);
app.use('/books', verifyToken, bookRoutes);
app.use('/movies', verifyToken, movieRoutes);

app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
