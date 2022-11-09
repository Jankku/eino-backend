FROM node:lts AS build
WORKDIR /usr/src/eino
COPY package*.json ./
RUN apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev && npm install --build-from-source
RUN apt-get remove -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:lts
WORKDIR /usr/src/eino
COPY package*.json ./
RUN apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev && npm ci --omit=dev --build-from-source
RUN apt-get remove -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev
COPY --from=build /usr/src/eino/dist ./dist
COPY --from=build /usr/src/eino/src/fonts ./src/fonts
EXPOSE 3000
CMD [ "node", "./dist/app.js" ]