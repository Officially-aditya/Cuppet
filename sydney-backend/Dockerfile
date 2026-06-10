FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./

FROM base AS dev
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY worker.ts ./worker.ts

CMD ["npm", "run", "dev:api"]

FROM base AS build
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY worker.ts ./worker.ts

RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/src/index.js"]
