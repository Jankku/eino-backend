FROM node:14 as build
WORKDIR /usr/src/entertainmentlist-build
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm run build

FROM node:14
WORKDIR /usr/src/entertainmentlist
COPY package*.json ./
RUN npm ci
RUN npm install pm2 -g
COPY --from=build /usr/src/entertainmentlist-build/dist ./dist
EXPOSE 3000
CMD [ "pm2-runtime", "./dist/app.js" ]