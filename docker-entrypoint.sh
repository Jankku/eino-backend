#!/bin/ash
npm run migrate up -- --migrations-dir=./dist/migrations
node --disable-proto=throw ./dist/src/app.js
