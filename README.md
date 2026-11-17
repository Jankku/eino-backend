<h1 align="center">
<br>
  <img src="https://user-images.githubusercontent.com/29043938/162579519-748732e4-51b3-42f4-b04b-a015520f80a8.png" style="width: 80px;" />
<br>
Eino
</h1>
<div align="center">
<h4>Book and movie tracker with web and Android clients.</h4>
<h4>You can find web frontend code <a href="https://github.com/jankku/eino-web/">here</a> and Android code <a href="https://github.com/jankku/eino-android/">here</a>.</h4>
</div>

## Documentation

You can find the Swagger API documentation [here](https://eino.jankku.fi/api/v2/docs/).

## Features

- Authentication and authorization
  - Register and login
  - Password strength checker
  - User roles
  - TOTP two-factor authentication
  - Password reset via email, using Mailtrap
- Admin
  - Audit log
    - See user actions
    - Discord webhook support
  - Users
    - Modify user details
    - Enable/disable user account
  - Bulletins
    - Public, specific users, on predefined condition
    - Conditions
      - 2FA not enabled
      - Email not verified
      - Account anniversary
- Books and movies
  - CRUD operations
  - Sorting, ordering and filtering
  - Third-party integrations for images
    - Finna
    - Open Library
    - TMDB
- Profile
  - Account information
  - Profile picture
  - Generate an image of top 10 books/movies
  - Statistics for books and movies
    - Count by status
    - Pages read / hours watched
    - Average score and score distribution
  - Export/import account data
  - Delete account

## Get started

Eino uses Docker Compose, so getting it up and running is simple.

Clone repository.
```
$ git clone https://github.com/Jankku/eino-backend
```

Navigate to the folder.
```
$ cd eino-backend/
```

Create `.env` file from the example and fill in the values. See the comments in [`.env.example`](.env.example) for what each variable does.
```
$ cp .env.example .env
```

> [!NOTE]
> You may want to edit `docker-compose.yml` and remove `nginx` container. It has been configured for my own use.

Start database and app container.
```
$ docker compose up -d
```

Create the admin account.
```
$ docker compose exec app npm run create-admin
```

## Development seed data

Fill a development database with varied data that reaches every field's limits, for testing performance and how clients render it.

```sh
npm run seed                       # replace seed data
npm run seed -- --heavy 100000     # more items for seed_heavy
npm run seed -- --clean            # remove seed data
npm run seed -- --help             # all options
```

Seeded users are named `seed_*` and share one password, which the script prints. Existing data is left untouched.

## Fontconfig warnings on Linux

When running locally, the prebuilt `canvas` binary can bundle an older Fontconfig library than the system configuration in `/etc/fonts/conf.d`. This can cause warnings about `xsi:nil` or invalid constants.

Install the [native build dependencies](https://github.com/Automattic/node-canvas/wiki/_pages). This builds `canvas` against the system libraries:

```sh
npm exec -- node-gyp rebuild --directory=node_modules/canvas
```

## License
Licensed under the [MIT License](https://github.com/Jankku/eino-backend/blob/master/LICENSE.md).
