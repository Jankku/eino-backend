FROM mhart/alpine-node:16.4 AS build
USER node
WORKDIR /usr/src/eino
COPY package.json package-lock.json ./
RUN npm install
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm run build

FROM mhart/alpine-node:16.4
USER node
WORKDIR /usr/src/eino
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY --chown=node:node --from=build /usr/src/eino/dist ./dist
EXPOSE 3000
CMD [ "node", "./dist/app.js" ]