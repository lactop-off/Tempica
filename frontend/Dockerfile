# ── build stage ────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# rewrites() の宛先はビルド時に焼き込まれるため、ここで backend を指定する
ARG BACKEND_ORIGIN=http://backend:3000
ENV BACKEND_ORIGIN=${BACKEND_ORIGIN}
RUN npm run build

# ── runtime stage（Next.js standalone 出力） ───────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 8080
CMD ["node", "server.js"]
