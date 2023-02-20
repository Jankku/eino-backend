FROM node:lts AS build
WORKDIR /usr/src/eino
COPY package*.json tsconfig.json ./
RUN apt-get update \
	&& apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev \
	&& npm ci --build-from-source \
	&& apt-get remove -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev
COPY src ./src
COPY migrations ./migrations
RUN npm run build

FROM node:lts
WORKDIR /usr/src/eino
COPY package*.json docker-entrypoint.sh ./
RUN apt-get update \
	&& apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev \
	&& npm ci --omit=dev --build-from-source \
	&& apt-get remove -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev
COPY --from=build /usr/src/eino/dist ./dist
COPY --from=build /usr/src/eino/src/fonts ./src/fonts
