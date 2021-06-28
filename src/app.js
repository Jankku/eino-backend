require("dotenv").config();
const express = require("express");
const app = express();
const helmet = require("helmet");
const port = process.env.PORT || 3000;

// Routes
const authRoutes = require("./routes/auth");
const movieRoutes = require("./routes/movies");
const bookRoutes = require("./routes/books");

app.use(express.json());
app.use(helmet());

app.use("/auth", authRoutes);
app.use("/books", bookRoutes);
app.use("/movies", movieRoutes);

app.listen(port, () => {
    console.log(`Listening to port ${port}`);
});
