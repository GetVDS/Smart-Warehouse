# 使用官方Node.js运行时作为基础镜像
FROM node:18-alpine AS base

# 安装依赖阶段
FROM base AS deps
# 检查https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# 复制package文件和脚本
COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/

# 安装所有依赖（包括开发依赖，因为构建需要）
RUN npm ci --legacy-peer-deps --registry=https://registry.npmmirror.com && npm cache clean --force

# 确保生产依赖完整性
RUN npm ls bcryptjs || npm install bcryptjs --registry=https://registry.npmmirror.com
RUN npm ls jsonwebtoken || npm install jsonwebtoken --registry=https://registry.npmmirror.com
RUN npm ls @prisma/client || npm install @prisma/client --registry=https://registry.npmmirror.com

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma/
COPY . .

# 生成Prisma客户端
RUN npx prisma generate

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED 1

# 构建应用
RUN npm run build

# 运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 安装curl用于健康检查
RUN apk add --no-cache curl

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制prisma相关文件
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 复制必要的生产依赖
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# 创建数据库目录
RUN mkdir -p db && chown -R nextjs:nodejs db

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动应用
CMD ["node", "server.js"]