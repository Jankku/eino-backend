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

You can find the API documentation on [wiki](https://github.com/Jankku/eino-backend/wiki).

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

Rename `.env.example` to `.env`.
```
$ mv .env.example .env
```

Fill `.env` file with these env variables:

```
# 5000 is default port
PORT=
DATABASE_URL=postgresql://<username>:<password>@database:5432/eino
POSTGRES_USER=<username>
POSTGRES_PASSWORD=<password>
POSTGRES_DB=eino

ACCESS_TOKEN_SECRET=<long secret here>
REFRESH_TOKEN_SECRET=<long secret here>
# number in seconds, or a string time span (https://github.com/vercel/ms)
ACCESS_TOKEN_VALIDITY=3600
REFRESH_TOKEN_VALIDITY=1d

# Required for searching movie posters
TMDB_API_KEY=
```

Start the containers.
```
$ docker compose up -d
```

## License
Licensed under the [MIT License](https://github.com/Jankku/eino-backend/blob/master/LICENSE.md).