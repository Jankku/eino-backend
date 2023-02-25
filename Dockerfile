FROM node:lts-slim AS build
WORKDIR /usr/src/eino
COPY package*.json tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN apt-get update \
        && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev \
        && npm ci --build-from-source \
        && npm run build

FROM node:lts-slim
WORKDIR /usr/src/eino
COPY package*.json docker-entrypoint.sh ./
RUN apt-get update \
        && apt-get install -y libcairo2 libpango1.0
COPY --from=build /usr/src/eino/node_modules ./node_modules
COPY --from=build /usr/src/eino/dist ./dist
COPY --from=build /usr/src/eino/src/fonts ./src/fonts
