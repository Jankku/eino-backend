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

Create `.env` file.
```
$ touch .env
```

Fill `.env` file with these env variables:

```
# Database connection 
DATABASE_URL=postgresql://<username>:<password>@database:5432/eino

# Credentials for docker postgres
# Make sure the credentials are the same as in DATABASE_URL
POSTGRES_USER=<username>
POSTGRES_PASSWORD=<password>
POSTGRES_DB=eino

# 5000 is default app port
PORT=5000

# Optional, used for searching movie posters
TMDB_API_KEY=

# All three options are optional as by default emails are logged to console
# Sender and Mailtrap token are required if you want to send emails in production
EMAIL_SENDER=no-reply@example.com
EMAIL_MAILTRAP_TOKEN=
EMAIL_MAILTRAP_TEST_INBOX_ID=

# Execute jwtsecret.sh script to fill these or manually input a long secret
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=

# number in seconds or a string time span (https://github.com/vercel/ms)
ACCESS_TOKEN_VALIDITY=3600
REFRESH_TOKEN_VALIDITY=1d

# Maximum size for JSON request bodies
REQUEST_BODY_MAX_SIZE=10mb

# Books and movies have max count to prevent abuse
USER_LIST_ITEM_MAX_COUNT=100000
```

Start database and app container.
```
$ docker compose up -d
```

## License
Licensed under the [MIT License](https://github.com/Jankku/eino-backend/blob/master/LICENSE.md).