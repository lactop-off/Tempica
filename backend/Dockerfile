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

EXPOSE 3000
# マイグレーションは compose 側の手順で実行する（docker compose exec backend npm run prisma:deploy）
CMD ["node", "dist/main.js"]
