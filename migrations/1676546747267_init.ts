/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  pgm.createType('book_status', ['completed', 'reading', 'on-hold', 'dropped', 'planned']);
  pgm.createType('movie_status', ['completed', 'watching', 'on-hold', 'dropped', 'planned']);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users
    (
        user_id    uuid                  DEFAULT uuid_generate_v4(),
        username   VARCHAR(255) NOT NULL UNIQUE,
        password   VARCHAR(255) NOT NULL,
        created_on timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
        PRIMARY KEY (user_id)
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS books
    (
        book_id    uuid                  DEFAULT uuid_generate_v4(),
        isbn       VARCHAR(255) NOT NULL,
        title      VARCHAR(255) NOT NULL,
        author     VARCHAR(255) NOT NULL,
        publisher  VARCHAR(255) NOT NULL,
        pages      INTEGER      NOT NULL DEFAULT 0 CHECK (pages >= 0),
        year       INTEGER      NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE) CHECK (year >= 0),
        submitter  VARCHAR(255) NOT NULL,
        created_on timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
        document   tsvector,
        PRIMARY KEY (book_id),
        CONSTRAINT fk_users_books_username
            FOREIGN KEY (submitter)
                REFERENCES users (username)
                ON DELETE cascade
    );
  `);

  pgm.sql(`
    CREATE FUNCTION books_tsvector_trigger() RETURNS trigger AS
    $$
    begin
        new.document = setweight(to_tsvector('english', new.title), 'A') ||
                    setweight(to_tsvector('english', new.author), 'B') ||
                    setweight(to_tsvector('english', new.publisher), 'B');
        return new;
    end
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER books_tsvector_update
        BEFORE INSERT OR UPDATE
        ON books
        FOR EACH ROW
    EXECUTE PROCEDURE books_tsvector_trigger();
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_book_list
    (
        book_id    uuid,
        username   VARCHAR(255) NOT NULL,
        status     book_status  NOT NULL DEFAULT 'planned',
        score      INTEGER      NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 10),
        start_date DATE,
        end_date   DATE,
        created_on timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
        PRIMARY KEY (book_id),
        CONSTRAINT fk_users_book_list_user
            FOREIGN KEY (username)
                REFERENCES users (username)
                ON DELETE cascade,
        CONSTRAINT fk_users_list_book_id
            FOREIGN KEY (book_id)
                REFERENCES books (book_id)
                ON DELETE cascade
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS movies
    (
        movie_id   uuid                  DEFAULT uuid_generate_v4(),
        title      VARCHAR(255) NOT NULL,
        studio     VARCHAR(255) NOT NULL,
        director   VARCHAR(255) NOT NULL,
        writer     VARCHAR(255) NOT NULL,
        duration   INTEGER      NOT NULL DEFAULT 0 CHECK (duration >= 0),
        year       INTEGER      NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE) CHECK (year >= 0),
        submitter  VARCHAR(255) NOT NULL,
        created_on timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
        document   tsvector,
        PRIMARY KEY (movie_id),
        CONSTRAINT fk_users_movies_username
            FOREIGN KEY (submitter)
                REFERENCES users (username)
                ON DELETE cascade
    );
  `);

  pgm.sql(`
    CREATE FUNCTION movies_tsvector_trigger() RETURNS trigger AS
    $$
    begin
        new.document = setweight(to_tsvector('english', new.title), 'A') ||
                    setweight(to_tsvector('english', new.studio), 'B') ||
                    setweight(to_tsvector('english', new.director), 'B') ||
                    setweight(to_tsvector('english', new.writer), 'B');
        return new;
    end
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER movies_tsvector_update
        BEFORE INSERT OR UPDATE
        ON movies
        FOR EACH ROW
    EXECUTE PROCEDURE movies_tsvector_trigger();
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_movie_list
    (
        movie_id   uuid,
        username   VARCHAR(255) NOT NULL,
        status     movie_status NOT NULL DEFAULT 'planned',
        score      INTEGER      NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 10),
        start_date DATE,
        end_date   DATE,
        created_on timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
        PRIMARY KEY (movie_id),
        CONSTRAINT fk_users_movie_list_user
            FOREIGN KEY (username)
                REFERENCES users (username)
                ON DELETE cascade,
        CONSTRAINT fk_users_list_movie_id
            FOREIGN KEY (movie_id)
                REFERENCES movies (movie_id)
                ON DELETE cascade
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS shares (
        username   VARCHAR(255),
        share_id   VARCHAR(255) NOT NULL,
        created_on timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
        PRIMARY KEY (username),
        CONSTRAINT fk_users_username
            FOREIGN KEY (username)
                REFERENCES users (username)
                ON DELETE cascade
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('shares', { ifExists: true, cascade: true });
  pgm.dropTable('user_book_list', { ifExists: true, cascade: true });
  pgm.dropTable('user_movie_list', { ifExists: true, cascade: true });
  pgm.dropTable('books', { ifExists: true, cascade: true });
  pgm.dropTable('movies', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });

  pgm.dropFunction('books_tsvector_trigger', [], { ifExists: true, cascade: true });
  pgm.dropTrigger('books', 'books_tsvector_update', { ifExists: true, cascade: true });

  pgm.dropFunction('movies_tsvector_trigger', [], { ifExists: true, cascade: true });
  pgm.dropTrigger('movies', 'movies_tsvector_update', { ifExists: true, cascade: true });

  pgm.dropType('book_status', { ifExists: true });
  pgm.dropType('movie_status', { ifExists: true });
  pgm.dropExtension('uuid-ossp', { ifExists: true });
}
