#!/usr/bin/env sh
set -eu

npm run start:worker &
exec npm run start:api
