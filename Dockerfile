FROM node:26-alpine AS dependencies
WORKDIR /home/node/eino
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev
COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM dependencies AS build
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build

FROM node:26-alpine
WORKDIR /home/node/eino
RUN apk add --no-cache cairo jpeg pango && mkdir -p /home/node/eino/profilepicture && chown -R node:node /home/node/eino
COPY --chown=node:node package*.json docker-entrypoint.sh ./
COPY --chown=node:node --from=production-dependencies /home/node/eino/node_modules ./node_modules
COPY --chown=node:node --from=build /home/node/eino/src/fonts ./src/fonts
COPY --chown=node:node --from=build /home/node/eino/src/docs-*.yaml ./src/
COPY --chown=node:node --from=build /home/node/eino/dist ./dist
USER node
