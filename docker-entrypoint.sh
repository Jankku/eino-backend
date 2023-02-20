#!/bin/bash
npm run migrate up -- --migrations-dir=./dist/migrations
node ./dist/src/app.js
