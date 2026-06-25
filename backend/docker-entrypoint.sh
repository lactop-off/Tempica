#!/bin/sh
# コンテナ起動時にマイグレーション適用と初期データ投入（冪等）を行ってからアプリを起動する。
# worker など migrate/seed が不要なプロセスでは AUTO_MIGRATE=false を指定する。
set -e

if [ "${AUTO_MIGRATE:-true}" = "true" ]; then
  echo "[entrypoint] prisma migrate deploy ..."
  npx prisma migrate deploy

  if [ "${AUTO_SEED:-true}" = "true" ]; then
    echo "[entrypoint] seeding (idempotent) ..."
    # シードは冪等（組織が存在すればスキップ）。失敗してもアプリ起動はブロックしない。
    node dist/seed.js || echo "[entrypoint] seed skipped or failed; continuing"
  fi
fi

exec "$@"
