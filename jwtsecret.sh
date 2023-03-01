#!/bin/bash
set -e

# Replaces the JWT secret placeholders in the .env file with random 32 byte hex strings
sed -i "s/ACCESS_TOKEN_SECRET=/ACCESS_TOKEN_SECRET=$(openssl rand -hex 32)/g" .env
sed -i "s/REFRESH_TOKEN_SECRET=/REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)/g" .env

echo "JWT secrets generated in .env file"