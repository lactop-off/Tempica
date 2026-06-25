# ── build stage ────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

# Prisma は OpenSSL を必要とする
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ── runtime stage ──────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
# entrypoint が起動時にマイグレーション + シード（冪等）を実行してからアプリを起動する。
# 無効化したい場合は AUTO_MIGRATE=false / AUTO_SEED=false を環境変数で指定する。
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
