CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TYPE book_status AS ENUM ('completed', 'reading', 'on-hold', 'dropped', 'planned');
CREATE TYPE movie_status AS ENUM ('completed', 'watching', 'on-hold', 'dropped', 'planned');

CREATE TABLE users
(
    user_id uuid DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_on timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

CREATE TABLE books
(
    book_id uuid DEFAULT uuid_generate_v4(),
    isbn VARCHAR(255),
    title TEXT NOT NULL,
    author VARCHAR(255),
    publisher VARCHAR(255),
    pages INTEGER NOT NULL DEFAULT 0 CHECK (pages >= 0),
    year INTEGER NOT NULL DEFAULT 0 CHECK (year >= 0),
    submitter VARCHAR(255) NOT NULL,
    created_on timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (book_id),
    CONSTRAINT fk_users_books_user
        FOREIGN KEY(submitter)
        REFERENCES users(username)
        ON DELETE cascade
);

CREATE TABLE user_book_list
(
    book_id uuid,
    username VARCHAR(255) NOT NULL,
    status book_status NOT NULL DEFAULT 'planned',
    score SMALLINT NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 10),
    created_on timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (book_id),
    CONSTRAINT fk_users_book_list_user
    	FOREIGN KEY(username)
    	REFERENCES users(username)
    	ON DELETE cascade,
    CONSTRAINT fk_users_list_book_id
    	FOREIGN KEY(book_id)
    	REFERENCES books(book_id)
    	ON DELETE cascade
);

CREATE TABLE movies
(
    movie_id uuid DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    studio VARCHAR(255),
    director VARCHAR(255),
    writer VARCHAR(255),
    duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
    year INTEGER NOT NULL DEFAULT 0 CHECK (year >= 0),
    submitter VARCHAR(255) NOT NULL,
    created_on timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (movie_id),
    CONSTRAINT fk_users_movies_user
        FOREIGN KEY(submitter)
        REFERENCES users(username)
        ON DELETE cascade
);

CREATE TABLE user_movie_list
(
    movie_id uuid,
    username VARCHAR(255) NOT NULL,
    status movie_status NOT NULL DEFAULT 'planned',
    score SMALLINT NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 10),
    created_on timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (movie_id),
    CONSTRAINT fk_users_movie_list_user
    	FOREIGN KEY(username)
    	REFERENCES users(username)
    	ON DELETE cascade,
    CONSTRAINT fk_users_list_movie_id
    	FOREIGN KEY(movie_id)
    	REFERENCES movies(movie_id)
    	ON DELETE cascade
);