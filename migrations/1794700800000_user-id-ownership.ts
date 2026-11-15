import type { MigrationBuilder } from 'node-pg-migrate';

// Items and shares reference users by user_id, so renaming a user no longer touches them.
// List rows take their owner from their book or movie instead of storing a second copy.
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Dropping the list owner would silently pick the submitter, so disagreements must be
  // resolved by hand first.
  pgm.sql(`
    DO $$
    DECLARE
      book_mismatches bigint;
      movie_mismatches bigint;
    BEGIN
      SELECT count(*) INTO book_mismatches
      FROM user_book_list ubl JOIN books b USING (book_id)
      WHERE ubl.username <> b.submitter;

      SELECT count(*) INTO movie_mismatches
      FROM user_movie_list uml JOIN movies m USING (movie_id)
      WHERE uml.username <> m.submitter;

      IF book_mismatches > 0 OR movie_mismatches > 0 THEN
        RAISE EXCEPTION 'List owners differ from item submitters (books: %, movies: %)',
          book_mismatches, movie_mismatches
          USING HINT = 'Resolve rows where user_book_list.username <> books.submitter or '
            'user_movie_list.username <> movies.submitter, then rerun the migration.';
      END IF;
    END $$;
  `);

  pgm.sql(`
    ALTER TABLE books ADD COLUMN user_id uuid;
    UPDATE books b SET user_id = u.user_id FROM users u WHERE u.username = b.submitter;
    ALTER TABLE books
      ALTER COLUMN user_id SET NOT NULL,
      ADD CONSTRAINT books_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
      DROP COLUMN submitter;

    ALTER TABLE movies ADD COLUMN user_id uuid;
    UPDATE movies m SET user_id = u.user_id FROM users u WHERE u.username = m.submitter;
    ALTER TABLE movies
      ALTER COLUMN user_id SET NOT NULL,
      ADD CONSTRAINT movies_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
      DROP COLUMN submitter;

    ALTER TABLE user_book_list DROP COLUMN username;
    ALTER TABLE user_movie_list DROP COLUMN username;

    ALTER TABLE shares ADD COLUMN user_id uuid;
    UPDATE shares s SET user_id = u.user_id FROM users u WHERE u.username = s.username;
    ALTER TABLE shares
      DROP CONSTRAINT shares_pkey,
      DROP COLUMN username,
      ADD PRIMARY KEY (user_id),
      ADD CONSTRAINT shares_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE books ADD COLUMN submitter varchar(255);
    UPDATE books b SET submitter = u.username FROM users u WHERE u.user_id = b.user_id;
    ALTER TABLE books
      ALTER COLUMN submitter SET NOT NULL,
      ADD CONSTRAINT fk_users_books_username
        FOREIGN KEY (submitter) REFERENCES users (username) ON DELETE CASCADE,
      DROP COLUMN user_id;

    ALTER TABLE movies ADD COLUMN submitter varchar(255);
    UPDATE movies m SET submitter = u.username FROM users u WHERE u.user_id = m.user_id;
    ALTER TABLE movies
      ALTER COLUMN submitter SET NOT NULL,
      ADD CONSTRAINT fk_users_movies_username
        FOREIGN KEY (submitter) REFERENCES users (username) ON DELETE CASCADE,
      DROP COLUMN user_id;

    ALTER TABLE user_book_list ADD COLUMN username varchar(255);
    UPDATE user_book_list ubl SET username = b.submitter FROM books b WHERE b.book_id = ubl.book_id;
    ALTER TABLE user_book_list
      ALTER COLUMN username SET NOT NULL,
      ADD CONSTRAINT fk_users_book_list_user
        FOREIGN KEY (username) REFERENCES users (username) ON DELETE CASCADE;

    ALTER TABLE user_movie_list ADD COLUMN username varchar(255);
    UPDATE user_movie_list uml SET username = m.submitter FROM movies m WHERE m.movie_id = uml.movie_id;
    ALTER TABLE user_movie_list
      ALTER COLUMN username SET NOT NULL,
      ADD CONSTRAINT fk_users_movie_list_user
        FOREIGN KEY (username) REFERENCES users (username) ON DELETE CASCADE;

    ALTER TABLE shares ADD COLUMN username varchar(255);
    UPDATE shares s SET username = u.username FROM users u WHERE u.user_id = s.user_id;
    ALTER TABLE shares
      DROP CONSTRAINT shares_pkey,
      DROP COLUMN user_id,
      ADD PRIMARY KEY (username),
      ADD CONSTRAINT fk_users_username
        FOREIGN KEY (username) REFERENCES users (username) ON DELETE CASCADE;
  `);
}
