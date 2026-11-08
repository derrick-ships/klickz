#!/bin/sh
cd -- "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
 /usr/bin/open https://nodejs.org/en/download
 printf 'Install Node.js 22 or newer, then open this launcher again.\n'
 exit 1
fi
exec node server.mjs
