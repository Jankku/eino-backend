FROM node:lts-alpine AS build
WORKDIR /usr/src/eino
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev
COPY package*.json tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN npm ci --build-from-source && npm run build

FROM node:lts-alpine
WORKDIR /usr/src/eino
RUN apk add --no-cache cairo jpeg pango
COPY package*.json docker-entrypoint.sh ./
COPY --from=build /usr/src/eino/node_modules ./node_modules
COPY --from=build /usr/src/eino/src ./src
COPY --from=build /usr/src/eino/dist ./dist
