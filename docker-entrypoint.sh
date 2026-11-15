#!/bin/ash

set -e
npm run migrate up -- --migrations-dir=./dist/migrations
exec node --disable-proto=throw ./dist/src/app.js
