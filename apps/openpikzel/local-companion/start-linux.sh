#!/bin/sh
cd -- "$(dirname "$0")" || exit 1
. "./install-image-support.sh"
exec node server.mjs
