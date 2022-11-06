import BookStatus from './bookstatus';

type DbBook = {
  book_id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pages: number;
  year: number;
  status: BookStatus;
  score: number;
  start_date: string;
  end_date: string;
  created_on: string;
};

export default DbBook;
