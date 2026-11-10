if [ ! -e node_modules/sharp ]; then
 printf 'first launch: installing image support, needs internet once\n'
 npm ci --omit=dev || true
fi
