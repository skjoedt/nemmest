#!/bin/sh
set -e

node migrate.js

echo "Starting server..."
exec node build/index.js
