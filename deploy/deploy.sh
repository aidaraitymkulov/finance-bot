#!/usr/bin/env bash
# Server-side deploy for the bot. Run by the GitHub Actions deploy key as an SSH forced command
# (see docs/setup.md, "CI/CD"). Install it OUTSIDE the repo, e.g. /root/deploy-finance-bot.sh:
# a script inside the working tree would be rewritten by `git reset` while bash is still reading it.
set -euo pipefail

# `ssh <host> check` only proves that the key and this script work, without deploying anything.
if [ "${SSH_ORIGINAL_COMMAND:-}" = "check" ]; then
  echo "ok"
  exit 0
fi

APP_DIR=/var/www/finance-bot
APP_NAME=finance-bot

export NVM_DIR=/root/.nvm
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

# Two deploys at once would race on node_modules and dist/.
exec 9>/tmp/finance-bot-deploy.lock
flock -n 9 || { echo "Another deploy is running"; exit 1; }

cd "$APP_DIR"

echo "==> Fetching origin/main"
git fetch --quiet origin main
git reset --hard origin/main
git log --oneline -1

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

# Builds dist/ first, then applies pending migrations. On failure `set -e` stops here and the
# running bot keeps working on its already loaded code.
echo "==> Building and migrating"
npm run migration:run:prod

echo "==> Restarting"
pm2 startOrReload ecosystem.config.js --env production --update-env
pm2 save --force >/dev/null

# pm2 reports "online" for a process that crashes a second later, so wait and look again.
sleep 8
status=$(pm2 jlist | node -e '
  const apps = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const app = apps.find((item) => item.name === process.argv[1]);
  process.stdout.write(app ? app.pm2_env.status : "missing");
' "$APP_NAME")

if [ "$status" != "online" ]; then
  echo "Bot status is '$status' after restart; last log lines:"
  pm2 logs "$APP_NAME" --lines 30 --nostream || true
  exit 1
fi

echo "==> Deployed, bot is online"
