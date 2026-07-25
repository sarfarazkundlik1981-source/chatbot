FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm install

COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w @platform/contracts && npm run build -w @platform/api

CMD ["node", "apps/api/dist/apps/api/src/index.js"]
