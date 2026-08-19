# Gunakan Node.js 22 LTS
FROM node:22-alpine AS builder

WORKDIR /app

# Salin package.json dan instal dependensi
COPY package*.json ./
RUN npm ci

# Salin source code dan build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production image yang ringan
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

COPY package*.json ./
RUN npm ci --omit=dev

# Salin hasil build dari builder
COPY --from=builder /app/dist ./dist

# Buat folder sessions dan credentials jika belum ada
RUN mkdir -p sessions credentials

EXPOSE 8000

CMD ["node", "dist/index.js"]
