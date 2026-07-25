FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN npm install

COPY . .
RUN npm run build -w @platform/dashboard

CMD ["npm", "run", "start", "-w", "@platform/dashboard"]
