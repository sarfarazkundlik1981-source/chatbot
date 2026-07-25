FROM node:22-alpine AS base
WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN npm install

COPY . .
RUN npm run build -w @platform/dashboard

CMD ["npm", "run", "start", "-w", "@platform/dashboard"]
