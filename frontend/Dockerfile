# 前端 Dockerfile — 多阶段构建
FROM node:20-alpine AS builder
WORKDIR /app

# 构建参数：浏览器端 API 地址
ARG NEXT_PUBLIC_API_URL="/api/v1"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 运行时也需要这个环境变量
ARG NEXT_PUBLIC_API_URL="/api/v1"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
