import express from "express";
import * as books from "../services/booklist";
import * as movies from "../services/movielist";

const router = express.Router();

// Book routes
router.get("/books/search", books.searchBook);
router.get("/books/book/:bookId", books.getBookById);
router.post("/books/add", books.addBookToList);
router.put("/books/update/:bookId", books.updateBook);
router.delete("/books/delete/:bookId", books.deleteBook);

router.get("/books/all", books.getFullList);
router.get("/books/completed", (req, res, next) => books.fetchListByStatus(req, res, "completed", next));
router.get("/books/reading", (req, res, next) => books.fetchListByStatus(req, res, "reading", next));
router.get("/books/on-hold", (req, res, next) => books.fetchListByStatus(req, res, "on-hold", next));
router.get("/books/dropped", (req, res, next) => books.fetchListByStatus(req, res, "dropped", next));
router.get("/books/planned", (req, res, next) => books.fetchListByStatus(req, res, "planned", next));

// Movie routes
router.get("/movies/search", movies.searchMovie);
router.get("/movies/movie/:movieId", movies.getMovieById);
router.post("/movies/add", movies.addMovieToList);
router.put("/movies/update/:movieId", movies.updateMovie);
router.delete("/movies/delete/:movieId", movies.deleteMovie);

router.get("/movies/all", movies.getFullList);
router.get("/movies/completed", (req, res, next) => movies.fetchListByStatus(req, res, "completed", next));
router.get("/movies/watching", (req, res, next) => movies.fetchListByStatus(req, res, "watching", next));
router.get("/movies/on-hold", (req, res, next) => movies.fetchListByStatus(req, res, "on-hold", next));
router.get("/movies/dropped", (req, res, next) => movies.fetchListByStatus(req, res, "dropped", next));
router.get("/movies/planned", (req, res, next) => movies.fetchListByStatus(req, res, "planned", next));

export default router;
