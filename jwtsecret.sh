#!/bin/bash
set -e

# Replaces the secret placeholders in the .env file with random 32 byte hex strings
sed -i "s/ACCESS_TOKEN_SECRET=/ACCESS_TOKEN_SECRET=$(openssl rand -hex 32)/g" .env
sed -i "s/REFRESH_TOKEN_SECRET=/REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)/g" .env

echo "Secrets generated in .env file"