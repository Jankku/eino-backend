FROM mhart/alpine-node:latest as build
WORKDIR /usr/src/eino
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm run build

FROM mhart/alpine-node:latest
WORKDIR /usr/src/eino
COPY package*.json ./
RUN npm ci && npm install pm2 -g
COPY --from=build /usr/src/eino/dist ./dist
EXPOSE 3000
CMD [ "pm2-runtime", "./dist/app.js" ]