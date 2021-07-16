FROM node:14

WORKDIR /usr/src/entertainmentlist

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD [ "npm", "start" ]