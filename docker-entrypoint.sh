#!/bin/ash
npm run migrate up -- --migrations-dir=./dist/migrations
# Replace the shell so Node receives stop signals directly.
exec node --disable-proto=throw ./dist/src/app.js
