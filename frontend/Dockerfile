# プレースホルダ用の軽量イメージ（デザイン確定後に Next.js standalone へ置き換え）
FROM node:22-slim AS runtime
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
EXPOSE 8080
CMD ["node", "server.js"]
