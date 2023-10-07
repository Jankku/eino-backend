FROM node:lts-alpine AS build
WORKDIR /home/node/eino
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev
COPY package*.json tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN npm ci --build-from-source && npm run build

FROM node:lts-alpine
WORKDIR /home/node/eino
RUN apk add --no-cache cairo jpeg pango && chown -R node:node /home/node/eino
COPY --chown=node:node package*.json docker-entrypoint.sh ./
COPY --chown=node:node --from=build /home/node/eino/node_modules ./node_modules
COPY --chown=node:node --from=build /home/node/eino/src ./src
COPY --chown=node:node --from=build /home/node/eino/dist ./dist
USER node