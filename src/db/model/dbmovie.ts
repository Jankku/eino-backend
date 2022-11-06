import MovieStatus from './moviestatus';

type DbMovie = {
  movie_id: string;
  title: string;
  studio: string;
  director: string;
  writer: string;
  duration: number;
  year: number;
  status: MovieStatus;
  score: number;
  start_date: string;
  end_date: string;
  created_on: string;
};

export default DbMovie;
